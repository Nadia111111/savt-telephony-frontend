'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StatisticsTotals,
  StatisticsBucket,
  StatisticsCallsResponse,
  CallerStatsItem,
  CallerStatsResponse,
} from '@/types/telephony';
import { getMinskDateRange, formatDateTimeFull } from '@/lib/date-utils';
import { useDepartmentFilterOptions } from '@/lib/departments-filter';
import { apiFetch, extractApiError } from '@/lib/api-client';
import {
  Users,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  PhoneCall,
  Search,
} from 'lucide-react';

type SliceKey = 'incoming' | 'missed' | 'outgoing';

const MINSK_YMD_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Minsk',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const MONTH_SHORT_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTH_FULL_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function toMinskYMD(isoStr: string): string {
  const match = isoStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoStr.length === 10 && match) return match[1];
  try {
    return MINSK_YMD_FORMATTER.format(new Date(isoStr));
  } catch {
    return isoStr.slice(0, 10);
  }
}

function parseYMD(ymd: string): { year: number; month: number; day: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function formatYMDFromUTC(utcMs: number): string {
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatBucketLabel(bucketStart: string, groupBy: 'day' | 'week' | 'month'): string {
  const ymd = toMinskYMD(bucketStart);
  const { year, month, day } = parseYMD(ymd);
  if (groupBy === 'month') {
    return `${MONTH_SHORT_RU[(month - 1) % 12]} ${String(year).slice(-2)}`;
  }
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`;
}

function formatBucketTooltipTitle(bucketStart: string, groupBy: 'day' | 'week' | 'month'): string {
  const ymd = toMinskYMD(bucketStart);
  const { year, month, day } = parseYMD(ymd);
  if (groupBy === 'month') {
    return `${MONTH_FULL_RU[(month - 1) % 12]} ${year}`;
  }
  const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const formatted = dateObj.toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Minsk',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return groupBy === 'week' ? `Неделя с ${formatted}` : formatted;
}

function buildFilledBuckets(
  buckets: StatisticsBucket[],
  dateFrom: string,
  dateTo: string,
  groupBy: 'day' | 'week' | 'month',
  periodPreset: 'month' | 'prev_week' | 'week' | 'prev_month' | 'all'
): StatisticsBucket[] {
  const map = new Map<string, StatisticsBucket>();
  for (const b of buckets) {
    const ymd = toMinskYMD(b.bucket_start);
    const key = groupBy === 'month' ? ymd.slice(0, 7) : ymd;
    map.set(key, b);
  }

  let startYMD = toMinskYMD(dateFrom);
  let endYMD = toMinskYMD(dateTo);

  // Для годового периода в разрезе дней ограничиваем пустой диапазон вокруг фактических данных (чтобы не рисовать 365 пустых столбцов)
  if (periodPreset === 'all' && groupBy === 'day') {
    if (buckets.length === 0) return [];
    const sortedYMDs = buckets.map((b) => toMinskYMD(b.bucket_start)).sort();
    const first = parseYMD(sortedYMDs[0]);
    const last = parseYMD(sortedYMDs[sortedYMDs.length - 1]);
    const firstMs = Date.UTC(first.year, first.month - 1, first.day);
    const lastMs = Date.UTC(last.year, last.month - 1, last.day);
    // Показываем минимум 14 дней для наглядности динамики, не раздувая свыше 45 дней
    const minSpanStartMs = lastMs - 13 * 86400000;
    const clampedStartMs = Math.max(Math.min(firstMs, minSpanStartMs), lastMs - 44 * 86400000);
    startYMD = formatYMDFromUTC(clampedStartMs);
    endYMD = formatYMDFromUTC(lastMs + 86400000);
  }

  const start = parseYMD(startYMD);
  const end = parseYMD(endYMD);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);

  const emptyBucket = (ymd: string): StatisticsBucket => ({
    bucket_start: `${ymd}T00:00:00+03:00`,
    incoming: 0,
    outgoing: 0,
    missed: 0,
    missed_with_voicemail: 0,
    missed_without_voicemail: 0,
    total: 0,
  });

  const result: StatisticsBucket[] = [];

  if (groupBy === 'day') {
    let curMs = Date.UTC(start.year, start.month - 1, start.day);
    while (curMs < endMs && result.length < 62) {
      const ymd = formatYMDFromUTC(curMs);
      result.push(map.get(ymd) ?? emptyBucket(ymd));
      curMs += 86400000;
    }
  } else if (groupBy === 'week') {
    const startDate = new Date(Date.UTC(start.year, start.month - 1, start.day));
    const dow = startDate.getUTCDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    let curMs = startDate.getTime() + diffToMon * 86400000;
    while (curMs < endMs && result.length < 60) {
      const ymd = formatYMDFromUTC(curMs);
      result.push(map.get(ymd) ?? emptyBucket(ymd));
      curMs += 7 * 86400000;
    }
  } else {
    let curY = start.year;
    let curM = start.month;
    while (Date.UTC(curY, curM - 1, 1) < endMs && result.length < 24) {
      const ym = `${curY}-${String(curM).padStart(2, '0')}`;
      const ymd = `${ym}-01`;
      result.push(map.get(ym) ?? emptyBucket(ymd));
      curM += 1;
      if (curM > 12) {
        curM = 1;
        curY += 1;
      }
    }
  }

  return result;
}

export default function StatisticsPage() {
  // Две вкладки по спецификации бэкендера: "Количество звонков" и "По номерам клиентов"
  const [tab, setTab] = useState<'calls' | 'callers'>('calls');

  // Общие фильтры. По умолчанию ставим "month" (Текущий месяц), чтобы звонки отображались сразу!
  const [periodPreset, setPeriodPreset] = useState<'month' | 'prev_week' | 'week' | 'prev_month' | 'all'>('month');
  const [sector, setSector] = useState<string>('');
  const [searchCaller, setSearchCaller] = useState<string>('');
  const [debouncedCaller, setDebouncedCaller] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);

  const { departmentOptions, departmentsUnavailable } = useDepartmentFilterOptions();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCaller(searchCaller.trim());
      setCallersOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchCaller]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Управление группировкой
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  // Пагинация для вкладки "По номерам клиентов"
  const [callersOffset, setCallersOffset] = useState<number>(0);
  const callersLimit = 50;

  // Данные с сервера
  const [callsData, setCallsData] = useState<{ totals: StatisticsTotals; buckets: StatisticsBucket[] }>({
    totals: { incoming: 0, outgoing: 0, missed: 0, missed_with_voicemail: 0, missed_without_voicemail: 0, total: 0 },
    buckets: [],
  });
  const [callersData, setCallersData] = useState<{ items: CallerStatsItem[]; total: number }>({
    items: [],
    total: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Состояния интерактивности графиков
  const [hoveredBucketIdx, setHoveredBucketIdx] = useState<number | null>(null);
  const [hoveredSlice, setHoveredSlice] = useState<SliceKey | 'all' | null>(null);

  // Вычисление диапазона в ISO 8601 с часовым поясом (+03:00)
  const dateRange = useMemo(() => {
    return getMinskDateRange(periodPreset);
  }, [periodPreset]);

  // Загрузка статистики количества звонков
  const fetchCallsStats = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setBackendError(null);

    const params = new URLSearchParams();
    params.set('date_from', dateRange.dateFrom);
    params.set('date_to', dateRange.dateTo);
    params.set('group_by', groupBy);
    if (sector) {
      params.set('sector', sector);
    }
    if (debouncedCaller) {
      params.set('caller', debouncedCaller);
    } else {
      params.delete('caller');
    }

    try {
      const res = await apiFetch(`/api/statistics/calls?${params.toString()}`, {
        signal: controller.signal,
      });
      if (res.status === 403) {
        setBackendError('Нет доступа к просмотру статистики');
        return;
      }
      if (!res.ok) {
        throw new Error(await extractApiError(res, `Ошибка загрузки статистики звонков (${res.status})`));
      }
      const data: StatisticsCallsResponse = await res.json();
      setCallsData({
        totals: data.totals,
        buckets: data.buckets || [],
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setBackendError(err.message || 'Сервер телефонии не отвечает');
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [dateRange, groupBy, sector, debouncedCaller]);

  // Загрузка статистики по номерам клиентов
  const fetchCallersStats = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setBackendError(null);

    const params = new URLSearchParams();
    params.set('limit', callersLimit.toString());
    params.set('offset', callersOffset.toString());
    params.set('date_from', dateRange.dateFrom);
    params.set('date_to', dateRange.dateTo);
    if (sector) {
      params.set('sector', sector);
    }
    if (debouncedCaller) {
      params.set('caller', debouncedCaller);
    } else {
      params.delete('caller');
    }

    try {
      const res = await apiFetch(`/api/statistics/callers?${params.toString()}`, {
        signal: controller.signal,
      });
      if (res.status === 403) {
        setBackendError('Нет доступа к статистике по номерам');
        return;
      }
      if (!res.ok) {
        throw new Error(await extractApiError(res, `Ошибка загрузки номеров клиентов (${res.status})`));
      }
      const data: CallerStatsResponse = await res.json();
      setCallersData({
        items: data.items || [],
        total: data.total || 0,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setBackendError(err.message || 'Сервер телефонии не отвечает');
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [dateRange, sector, debouncedCaller, callersOffset]);

  useEffect(() => {
    if (tab === 'calls') {
      fetchCallsStats();
    } else {
      fetchCallersStats();
    }
  }, [tab, fetchCallsStats, fetchCallersStats]);

  const handlePeriodChange = (val: 'month' | 'prev_week' | 'week' | 'prev_month' | 'all') => {
    setPeriodPreset(val);
    setCallersOffset(0);
  };

  const handleSectorChange = (val: string) => {
    setSector(val);
    setCallersOffset(0);
  };

  // Заполняем пропуски на графике динамики нулями
  const filledBuckets = useMemo(() => {
    return buildFilledBuckets(
      callsData.buckets,
      dateRange.dateFrom,
      dateRange.dateTo,
      groupBy,
      periodPreset
    );
  }, [callsData.buckets, dateRange.dateFrom, dateRange.dateTo, groupBy, periodPreset]);

  // Масштаб оси Y кратный 4, чтобы все 5 делений были целыми числами
  const maxBucketValue = useMemo(() => {
    if (!filledBuckets.length) return 4;
    const maxVal = Math.max(
      ...filledBuckets.map((b) => Math.max(b.incoming, b.outgoing, b.missed))
    );
    if (maxVal <= 0) return 4;
    const step = Math.ceil(maxVal / 4);
    return step * 4;
  }, [filledBuckets]);

  // Сегменты круговой диаграммы
  const donutSegments = useMemo(() => {
    const { incoming, missed, outgoing, missed_with_voicemail, missed_without_voicemail } = callsData.totals;
    const sum = incoming + missed + outgoing;
    const radius = 70;
    const circumference = 2 * Math.PI * radius;

    const raw = [
      {
        key: 'incoming' as SliceKey,
        label: 'Принятые входящие',
        shortLabel: 'Принятые',
        value: incoming,
        color: 'var(--in)',
        extra: null as string | null,
      },
      {
        key: 'missed' as SliceKey,
        label: 'Пропущенные',
        shortLabel: 'Пропущенные',
        value: missed,
        color: 'var(--miss)',
        extra: `с голосовым: ${missed_with_voicemail} · без: ${missed_without_voicemail}`,
      },
      {
        key: 'outgoing' as SliceKey,
        label: 'Исходящие',
        shortLabel: 'Исходящие',
        value: outgoing,
        color: 'var(--out)',
        extra: null as string | null,
      },
    ];

    let accumulated = 0;
    return raw.map((seg) => {
      const pct = sum > 0 ? (seg.value / sum) * 100 : 0;
      const arcLength = sum > 0 ? (seg.value / sum) * circumference : 0;
      const dashOffset = -accumulated;
      accumulated += arcLength;
      return {
        ...seg,
        pct,
        arcLength,
        dashOffset,
        circumference,
      };
    });
  }, [callsData.totals]);

  const activeDonutSlice = useMemo(() => {
    if (!hoveredSlice || hoveredSlice === 'all') return null;
    return donutSegments.find((s) => s.key === hoveredSlice) || null;
  }, [hoveredSlice, donutSegments]);

  const hoveredBucket =
    hoveredBucketIdx !== null && filledBuckets[hoveredBucketIdx]
      ? filledBuckets[hoveredBucketIdx]
      : null;

  return (
    <div>
      {/* Две вкладки по спецификации */}
      <div className="tabs">
        <button
          className={`tab ${tab === 'calls' ? 'active' : ''}`}
          onClick={() => setTab('calls')}
        >
          Количество звонков
        </button>
        <button
          className={`tab ${tab === 'callers' ? 'active' : ''}`}
          onClick={() => setTab('callers')}
        >
          По номерам клиентов
        </button>
      </div>

      {backendError && (
        <div className="info-banner" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <AlertCircle size={22} style={{ stroke: 'var(--miss)', flexShrink: 0 }} />
          <p style={{ color: 'var(--miss)' }}>
            <b>Сервер 127.0.0.1:18080 не подключен:</b> {backendError}.<br />
            Для связи с сервером убедитесь, что запущен туннель: <code>ssh -N -L 18080:127.0.0.1:8000 siptrunk@10.1.0.148</code>
          </p>
        </div>
      )}

      {/* Панель общих фильтров */}
      <div className="card">
        <div className="filters-row">
          <div className="field">
            <label>Период</label>
            <select
              className="select"
              value={periodPreset}
              onChange={(e) => handlePeriodChange(e.target.value as any)}
            >
              <option value="month">Текущий месяц (Ноябрь)</option>
              <option value="prev_week">Прошлая неделя (16–22 ноября)</option>
              <option value="week">Текущая неделя (23–29 ноября)</option>
              <option value="prev_month">Прошлый месяц (Октябрь)</option>
              <option value="all">За всё время (2026 год)</option>
            </select>
          </div>

          <div className="field">
            <label>Отдел</label>
            <select
              className="select"
              value={sector}
              onChange={(e) => handleSectorChange(e.target.value)}
            >
              {departmentOptions.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {departmentsUnavailable && (
              <span style={{ fontSize: 11, color: 'var(--miss)', marginTop: 4 }}>
                Справочник отделов недоступен
              </span>
            )}
          </div>

          {/* Поиск по номеру */}
          <div className="field">
            <label>Поиск по номеру</label>
            <div className="search" style={{ marginLeft: 0 }}>
              <input
                placeholder="Номер или часть..."
                value={searchCaller}
                onChange={(e) => setSearchCaller(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setDebouncedCaller(searchCaller.trim());
                    setCallersOffset(0);
                  }
                }}
              />
              <Search size={16} />
            </div>
          </div>

          {/* Группировка (только для вкладки "Количество звонков") */}
          {tab === 'calls' && (
            <div className="field">
              <label>Группировка графика</label>
              <div className="chips">
                <div
                  className={`chip ${groupBy === 'day' ? 'active' : ''}`}
                  onClick={() => setGroupBy('day')}
                >
                  По дням
                </div>
                <div
                  className={`chip ${groupBy === 'week' ? 'active' : ''}`}
                  onClick={() => setGroupBy('week')}
                >
                  По неделям
                </div>
                <div
                  className={`chip ${groupBy === 'month' ? 'active' : ''}`}
                  onClick={() => setGroupBy('month')}
                >
                  По месяцам
                </div>
              </div>
            </div>
          )}

          <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            <button className="btn" onClick={() => (tab === 'calls' ? fetchCallsStats() : fetchCallersStats())}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Обновить
            </button>
          </div>
        </div>
      </div>

      {/* ==================== ВКЛАДКА 1: КОЛИЧЕСТВО ЗВОНКОВ ==================== */}
      {tab === 'calls' && (
        <>
          {/* Карточки итогов из totals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
            <div className="card" style={{ margin: 0, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 12 }}>
                <PhoneCall size={18} /> Всего звонков
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--dark)', marginTop: 8 }}>
                {callsData.totals.total}
              </div>
            </div>

            <div className="card" style={{ margin: 0, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--in)', fontSize: 12 }}>
                <PhoneIncoming size={18} /> Принятые входящие
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--in)', marginTop: 8 }}>
                {callsData.totals.incoming}
              </div>
            </div>

            <div className="card" style={{ margin: 0, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--miss)', fontSize: 12 }}>
                <PhoneMissed size={18} /> Пропущенные
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--miss)' }}>
                  {callsData.totals.missed}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  с голосовым: <b>{callsData.totals.missed_with_voicemail}</b> / без: <b>{callsData.totals.missed_without_voicemail}</b>
                </div>
              </div>
            </div>

            <div className="card" style={{ margin: 0, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--out)', fontSize: 12 }}>
                <PhoneOutgoing size={18} /> Исходящие
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--out)', marginTop: 8 }}>
                {callsData.totals.outgoing}
              </div>
            </div>
          </div>

          {/* График и интерактивная круговая диаграмма */}
          <div className="card">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)' }}>
                Динамика вызовов ({groupBy === 'day' ? 'по дням' : groupBy === 'week' ? 'по неделям' : 'по месяцам'})
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--in)' }} />
                  Принятые входящие
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--out)' }} />
                  Исходящие
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--miss)' }} />
                  Пропущенные
                </span>
              </div>
            </div>

            {loading && callsData.buckets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                Загрузка статистики...
              </div>
            ) : callsData.totals.total === 0 || filledBuckets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                За выбранный период звонков нет
              </div>
            ) : (
              <div className="chart-wrap">
                {/* Столбчатый график динамики вызовов */}
                <div
                  className="bars-container"
                  onMouseLeave={() => setHoveredBucketIdx(null)}
                >
                  {hoveredBucket && hoveredBucketIdx !== null && (
                    <div
                      className="chart-tooltip"
                      style={{
                        top: -8,
                        left: hoveredBucketIdx > filledBuckets.length / 2 ? '56px' : undefined,
                        right: hoveredBucketIdx <= filledBuckets.length / 2 ? '12px' : undefined,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--dark)', marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                        {formatBucketTooltipTitle(hoveredBucket.bucket_start, groupBy)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ color: 'var(--muted)' }}>Принятые входящие</span>
                          <b className="c-in">{hoveredBucket.incoming}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ color: 'var(--muted)' }}>Исходящие</span>
                          <b className="c-out">{hoveredBucket.outgoing}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ color: 'var(--muted)' }}>Пропущенные</span>
                          <b className="c-miss">{hoveredBucket.missed}</b>
                        </div>
                        {hoveredBucket.missed > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 6 }}>
                            с голосовым: {hoveredBucket.missed_with_voicemail} · без: {hoveredBucket.missed_without_voicemail}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 2, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--dark)', fontWeight: 600 }}>Всего</span>
                          <b style={{ color: 'var(--dark)' }}>{hoveredBucket.total}</b>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bars-scroll">
                    <div
                      className="bars"
                      style={{ minWidth: filledBuckets.length > 18 ? `${filledBuckets.length * 30}px` : undefined }}
                    >
                      <div className="y-axis">
                        <span>{maxBucketValue}</span>
                        <span>{Math.round(maxBucketValue * 0.75)}</span>
                        <span>{Math.round(maxBucketValue * 0.5)}</span>
                        <span>{Math.round(maxBucketValue * 0.25)}</span>
                        <span>0</span>
                      </div>

                      <div className="y-grid">
                        <div className="y-grid-line" />
                        <div className="y-grid-line" />
                        <div className="y-grid-line" />
                        <div className="y-grid-line" />
                        <div className="y-grid-line" />
                      </div>

                      {filledBuckets.map((b, idx) => {
                        const inPct = b.incoming > 0 ? Math.max(4, Math.min(100, (b.incoming / maxBucketValue) * 100)) : 0;
                        const outPct = b.outgoing > 0 ? Math.max(4, Math.min(100, (b.outgoing / maxBucketValue) * 100)) : 0;
                        const missPct = b.missed > 0 ? Math.max(4, Math.min(100, (b.missed / maxBucketValue) * 100)) : 0;
                        const showLabel =
                          filledBuckets.length <= 16 ||
                          idx === 0 ||
                          idx === filledBuckets.length - 1 ||
                          idx % 2 === 0;

                        return (
                          <div
                            key={b.bucket_start}
                            className="month"
                            onMouseEnter={() => setHoveredBucketIdx(idx)}
                          >
                            <div className="bar-group">
                              <div
                                className="bar in"
                                style={{ height: `${inPct}%` }}
                              />
                              <div
                                className="bar out"
                                style={{ height: `${outPct}%` }}
                              />
                              <div
                                className="bar miss"
                                style={{ height: `${missPct}%` }}
                              />
                            </div>
                            <span className="month-label">
                              {showLabel ? formatBucketLabel(b.bucket_start, groupBy) : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Интерактивная круговая диаграмма и легенда */}
                <div
                  className="donut-wrap"
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  {hoveredSlice !== null && (
                    <div
                      className="chart-tooltip"
                      style={{
                        bottom: 'calc(100% - 16px)',
                        right: 0,
                        minWidth: 220,
                      }}
                    >
                      {activeDonutSlice ? (
                        <div style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 600, color: activeDonutSlice.color }}>
                              {activeDonutSlice.label}
                            </span>
                            <b style={{ color: 'var(--dark)' }}>
                              {activeDonutSlice.value} ({activeDonutSlice.pct.toFixed(1)}%)
                            </b>
                          </div>
                          {activeDonutSlice.extra && (
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                              {activeDonutSlice.extra}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontWeight: 600, color: 'var(--dark)', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                          Всего звонков: {callsData.totals.total}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {donutSegments.map((seg) => (
                          <div key={seg.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color }} />
                              {seg.label}
                            </span>
                            <b style={{ color: seg.color }}>
                              {seg.value} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({Math.round(seg.pct)}%)</span>
                            </b>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="donut">
                    <svg width="190" height="190" viewBox="0 0 190 190">
                      <circle cx="95" cy="95" r="70" fill="none" stroke="var(--border)" strokeWidth="22" opacity="0.45" />
                      {donutSegments.map((seg) => {
                        if (seg.value <= 0) return null;
                        const isHovered = hoveredSlice === seg.key;
                        const isDimmed = hoveredSlice !== null && hoveredSlice !== 'all' && !isHovered;
                        return (
                          <circle
                            key={seg.key}
                            className="donut-segment"
                            cx="95"
                            cy="95"
                            r="70"
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={isHovered ? 28 : 22}
                            strokeDasharray={`${seg.arcLength} ${seg.circumference}`}
                            strokeDashoffset={seg.dashOffset}
                            style={{
                              opacity: isDimmed ? 0.35 : 1,
                              filter: isHovered ? 'brightness(1.12) drop-shadow(0 0 6px rgba(15, 23, 42, 0.25))' : undefined,
                            }}
                            onMouseEnter={() => setHoveredSlice(seg.key)}
                          />
                        );
                      })}
                    </svg>

                    <div
                      className="donut-center"
                      onMouseEnter={() => setHoveredSlice('all')}
                    >
                      {activeDonutSlice ? (
                        <>
                          <span className="label" style={{ color: activeDonutSlice.color, fontWeight: 600 }}>
                            {activeDonutSlice.shortLabel}
                          </span>
                          <span className="total" style={{ color: activeDonutSlice.color }}>
                            {activeDonutSlice.value}
                          </span>
                          <span className="sub" style={{ color: 'var(--muted)' }}>
                            {activeDonutSlice.pct.toFixed(1)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="label">Всего</span>
                          <span className="total">{callsData.totals.total}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2, width: '100%', marginTop: 4 }}>
                    {donutSegments.map((seg) => {
                      const isActive = hoveredSlice === seg.key;
                      return (
                        <div
                          key={seg.key}
                          className={`donut-legend-row ${isActive ? 'active' : ''}`}
                          onMouseEnter={() => setHoveredSlice(seg.key)}
                          style={{
                            opacity: hoveredSlice && hoveredSlice !== 'all' && !isActive ? 0.5 : 1,
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }}>
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: seg.color }} />
                            {seg.label}
                          </span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                            <b style={{ color: seg.color }}>{seg.value}</b>
                            <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 4 }}>
                              ({Math.round(seg.pct)}%)
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== ВКЛАДКА 2: ПО НОМЕРАМ КЛИЕНТОВ ==================== */}
      {tab === 'callers' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Номер клиента</th>
                <th style={{ width: '25%' }}>Сколько раз звонил</th>
                <th style={{ width: '20%' }}>Из них пропущено</th>
                <th style={{ textAlign: 'right' }}>Последний звонок</th>
              </tr>
            </thead>
            <tbody>
              {loading && callersData.items.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                    <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 8px' }} />
                    Загрузка статистики по клиентам...
                  </td>
                </tr>
              ) : callersData.items.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
                    За выбранный период звонков нет
                  </td>
                </tr>
              ) : (
                callersData.items.map((c, idx) => (
                  <tr key={idx} className="data-row">
                    <td>
                      <div className="cell-icon">
                        <Users size={16} style={{ color: 'var(--primary)' }} />
                        <b style={{ color: 'var(--dark)' }}>{c.caller || 'Не определён'}</b>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: 13, padding: '4px 10px' }}>
                        {c.calls} {c.calls === 1 ? 'звонок' : c.calls < 5 ? 'звонка' : 'звонков'}
                      </span>
                    </td>
                    <td>
                      {c.missed > 0 ? (
                        <span className="badge badge-danger">
                          {c.missed} пропущено
                        </span>
                      ) : (
                        <span className="badge badge-success">
                          0
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatDateTimeFull(c.last_called_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Пагинация номеров клиентов */}
          {callersData.total > callersLimit && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                Показано {callersOffset + 1}–{Math.min(callersOffset + callersLimit, callersData.total)} из {callersData.total}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn"
                  disabled={callersOffset === 0}
                  onClick={() => setCallersOffset(Math.max(0, callersOffset - callersLimit))}
                >
                  <ChevronLeft size={16} /> Назад
                </button>
                <button
                  className="btn"
                  disabled={callersOffset + callersLimit >= callersData.total}
                  onClick={() => setCallersOffset(callersOffset + callersLimit)}
                >
                  Вперёд <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
