'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CallListItem, CallCounts, ActiveTab } from '@/types/telephony';
import { getMinskDateRange, formatDayHeader, formatTime, formatDuration } from '@/lib/date-utils';
import { useDepartmentFilterOptions, getEmployeeLabel } from '@/lib/departments-filter';
import { apiFetch, extractApiError } from '@/lib/api-client';
import { useAudioPlayer } from '@/components/AudioPlayerContext';
import CallDrawer from '@/components/CallDrawer';
import { ArrowDownLeft, ArrowUpRight, ArrowDownRight, Play, Volume2, Search, Filter, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const MOCK_CALLS: CallListItem[] = [
  {
    id: 16,
    started_at: '2026-11-20T16:24:00Z',
    ended_at: '2026-11-20T16:24:07Z',
    caller: '+375296214062',
    caller_raw: '+375 (29) 621-40-62',
    sector: 1,
    sector_name: 'Отдел продаж',
    sector_by_default: false,
    outcome: 'answered',
    answered_by: 'PJSIP/101',
    employee_name: 'Александр Долгополов',
    wait_seconds: 6,
    talk_seconds: 7,
    has_recording: true,
    has_message: false,
  },
  {
    id: 15,
    started_at: '2026-11-20T14:24:00Z',
    ended_at: '2026-11-20T14:24:05Z',
    caller: '+375296038704',
    caller_raw: '+375 (29) 603-87-04',
    sector: 2,
    sector_name: 'Служба поддержки',
    sector_by_default: false,
    outcome: 'abandoned_menu',
    answered_by: null,
    employee_name: 'Артём Горшков',
    wait_seconds: 5,
    talk_seconds: null,
    has_recording: false,
    has_message: false,
  },
  {
    id: 14,
    started_at: '2026-11-20T13:05:00Z',
    ended_at: '2026-11-20T13:06:32Z',
    caller: '+375296378799',
    caller_raw: '+375 (29) 637-87-99',
    sector: 1,
    sector_name: 'Отдел продаж',
    sector_by_default: false,
    outcome: 'answered',
    answered_by: 'PJSIP/102',
    employee_name: 'Ивар Бескостый',
    initiated_by: 'PJSIP/102',
    wait_seconds: 22,
    talk_seconds: 92,
    has_recording: true,
    has_message: false,
  },
  {
    id: 13,
    started_at: '2026-11-20T13:05:00Z',
    ended_at: '2026-11-20T13:23:10Z',
    caller: '+375296597057',
    caller_raw: '+375 (29) 659-70-57',
    sector: 3,
    sector_name: 'Отдел разработки ПО',
    sector_by_default: false,
    outcome: 'answered',
    answered_by: 'PJSIP/103',
    employee_name: 'Евгений Осипов',
    initiated_by: 'PJSIP/103',
    wait_seconds: 12,
    talk_seconds: 1090,
    has_recording: true,
    has_message: false,
  },
  {
    id: 12,
    started_at: '2026-11-20T12:12:00Z',
    ended_at: '2026-11-20T12:12:18Z',
    caller: '+375296105801',
    caller_raw: '+375 (29) 610-58-01',
    sector: 4,
    sector_name: 'Администрация',
    sector_by_default: false,
    outcome: 'answered',
    answered_by: 'PJSIP/104',
    employee_name: 'Анастасия Аксёнова',
    wait_seconds: 8,
    talk_seconds: 18,
    has_recording: true,
    has_message: false,
  },
  {
    id: 11,
    started_at: '2026-11-20T09:05:00Z',
    ended_at: '2026-11-20T09:06:24Z',
    caller: '+375296515747',
    caller_raw: '+375 (29) 651-57-47',
    sector: 5,
    sector_name: 'Бухгалтерия',
    sector_by_default: false,
    outcome: 'message_afterhours',
    answered_by: null,
    employee_name: 'Елена Герасимова',
    wait_seconds: 84,
    talk_seconds: 45,
    has_recording: false,
    has_message: true,
    voicemail_left: true,
  },
];

export default function HistoryPage() {
  const [typeTab, setTypeTab] = useState<'all' | ActiveTab>('all');
  const [voicemailFilter, setVoicemailFilter] = useState<'all' | 'true' | 'false'>('all');
  const [period, setPeriod] = useState<'month' | 'prev_week' | 'week' | 'prev_month' | 'all'>('month');
  const [sector, setSector] = useState<string>('');
  const [searchCaller, setSearchCaller] = useState<string>('');
  const [debouncedCaller, setDebouncedCaller] = useState<string>('');
  const [pageOffset, setPageOffset] = useState<number>(0);
  const pageSize = 50;
  const abortRef = useRef<AbortController | null>(null);

  const { departmentOptions, departmentsUnavailable } = useDepartmentFilterOptions();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCaller(searchCaller.trim());
      setPageOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchCaller]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const [calls, setCalls] = useState<CallListItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [counts, setCounts] = useState<CallCounts>({
    incoming: 65,
    outgoing: 139,
    missed: 72,
    missed_with_voicemail: 18,
    missed_without_voicemail: 54,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);

  const { playCall, currentCall } = useAudioPlayer();

  const currentRange = useMemo(() => {
    return getMinskDateRange(period);
  }, [period]);

  const fetchCalls = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setBackendError(null);

    const params = new URLSearchParams();
    params.set('limit', pageSize.toString());
    params.set('offset', pageOffset.toString());

    if (typeTab !== 'all') {
      params.set('tab', typeTab);
      if (typeTab === 'missed' && voicemailFilter !== 'all') {
        params.set('voicemail', voicemailFilter);
      }
    }

    if (currentRange.dateFrom) params.set('date_from', currentRange.dateFrom);
    if (currentRange.dateTo) params.set('date_to', currentRange.dateTo);

    if (sector) {
      params.set('sector', sector);
    }

    if (debouncedCaller) {
      params.set('caller', debouncedCaller);
    } else {
      params.delete('caller');
    }

    try {
      const res = await apiFetch(`/api/calls?${params.toString()}`, {
        signal: controller.signal,
      });
      if (res.status === 403) {
        setBackendError('Нет доступа к журналу звонков');
        setCalls([]);
        setTotal(0);
        return;
      }
      if (!res.ok) {
        throw new Error(await extractApiError(res, `Ошибка загрузки звонков (${res.status})`));
      }
      const data = await res.json();
      setCalls(data.items || []);
      setTotal(data.total || 0);

      // Загрузка счётчиков
      const countsParams = new URLSearchParams();
      if (currentRange.dateFrom) countsParams.set('date_from', currentRange.dateFrom);
      if (currentRange.dateTo) countsParams.set('date_to', currentRange.dateTo);
      if (sector) countsParams.set('sector', sector);
      if (debouncedCaller) countsParams.set('caller', debouncedCaller);
      else countsParams.delete('caller');

      const countsRes = await apiFetch(`/api/calls/counts?${countsParams.toString()}`, {
        signal: controller.signal,
      });
      if (countsRes.ok) {
        const countsData = await countsRes.json();
        setCounts(countsData);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setBackendError(err.message || 'Бэкенд недоступен');
      // В качестве мягкого fallback показываем моковые данные
      setCalls(MOCK_CALLS);
      setTotal(MOCK_CALLS.length);
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [typeTab, voicemailFilter, currentRange, sector, debouncedCaller, pageOffset]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const handleResetFilters = () => {
    setPeriod('week');
    setTypeTab('all');
    setVoicemailFilter('all');
    setSector('');
    setSearchCaller('');
    setDebouncedCaller('');
    setPageOffset(0);
  };

  // Группировка звонков по дням недели
  const groupedCalls = useMemo(() => {
    const groups: { [key: string]: CallListItem[] } = {};
    calls.forEach((c) => {
      const dayHeader = formatDayHeader(c.started_at);
      if (!groups[dayHeader]) {
        groups[dayHeader] = [];
      }
      groups[dayHeader].push(c);
    });
    return groups;
  }, [calls]);

  const totalAllCalls = (counts.incoming || 0) + (counts.missed || 0);

  return (
    <div>
      {/* Верхний заголовок-таб */}
      <div className="tabs">
        <button
          className="tab active"
          onClick={() => setPageOffset(0)}
        >
          Внешние звонки
        </button>
      </div>

      {backendError && (
        <div className="info-banner" style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <AlertCircle size={24} style={{ stroke: 'var(--miss)' }} />
          <p style={{ color: 'var(--miss)' }}>
            <b>Сервер телефонии не отвечает (127.0.0.1:18080):</b> {backendError}.<br />
            Показаны демонстрационные данные интерфейса. Для связи с живой ВМ запустите туннель: <code>ssh -N -L 18080:127.0.0.1:8000 siptrunk@10.1.0.148</code>
          </p>
        </div>
      )}

      {/* Панель фильтров */}
      <div className="card">
        <div className="filters-row">
          <div className="field">
            <label>Период</label>
            <select
              className="select"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as any);
                setPageOffset(0);
              }}
            >
              <option value="month">Текущий месяц (Ноябрь)</option>
              <option value="prev_week">Прошлая неделя (16–22 ноября)</option>
              <option value="week">Текущая неделя (23–29 ноября)</option>
              <option value="prev_month">Прошлый месяц (Октябрь)</option>
              <option value="all">За всё время (2026 год)</option>
            </select>
          </div>

          <div className="field">
            <label>Отдел (Сектор)</label>
            <select
              className="select"
              value={sector}
              onChange={(e) => {
                setSector(e.target.value);
                setPageOffset(0);
              }}
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

          <div className="field">
            <label>Тип звонка</label>
            <div className="chips">
              <div
                className={`chip ${typeTab === 'all' ? 'active' : ''}`}
                onClick={() => { setTypeTab('all'); setPageOffset(0); }}
              >
                Все <span className="num">{totalAllCalls}</span>
              </div>
              <div
                className={`chip ${typeTab === 'incoming' ? 'active' : ''}`}
                onClick={() => { setTypeTab('incoming'); setPageOffset(0); }}
              >
                <ArrowDownLeft className="arrow in" />
                Входящие <span className="num">{counts.incoming}</span>
              </div>
              <div
                className={`chip ${typeTab === 'missed' ? 'active' : ''}`}
                onClick={() => { setTypeTab('missed'); setPageOffset(0); }}
              >
                <ArrowDownRight className="arrow miss" />
                Пропущенные <span className="num">{counts.missed}</span>
              </div>
            </div>
          </div>

          {/* Дополнительный фильтр для пропущенных */}
          {typeTab === 'missed' && (
            <div className="field">
              <label>Голосовая почта</label>
              <div className="chips">
                <div
                  className={`chip ${voicemailFilter === 'all' ? 'active' : ''}`}
                  onClick={() => { setVoicemailFilter('all'); setPageOffset(0); }}
                >
                  Все
                </div>
                <div
                  className={`chip ${voicemailFilter === 'true' ? 'active' : ''}`}
                  onClick={() => { setVoicemailFilter('true'); setPageOffset(0); }}
                >
                  С голосовым <span className="num">{counts.missed_with_voicemail || 0}</span>
                </div>
                <div
                  className={`chip ${voicemailFilter === 'false' ? 'active' : ''}`}
                  onClick={() => { setVoicemailFilter('false'); setPageOffset(0); }}
                >
                  Без голосового <span className="num">{counts.missed_without_voicemail || 0}</span>
                </div>
              </div>
            </div>
          )}

          <div className="field" style={{ marginLeft: 'auto' }}>
            <div className="search">
              <input
                placeholder="Поиск по номеру..."
                value={searchCaller}
                onChange={(e) => setSearchCaller(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setDebouncedCaller(searchCaller.trim());
                    setPageOffset(0);
                  }
                }}
              />
              <Search size={16} />
            </div>
          </div>
        </div>

        <button className="reset" onClick={handleResetFilters}>
          Сбросить все фильтры
        </button>
      </div>

      {/* Таблица звонков */}
      <div className="card" style={{ padding: '8px 0', overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Клиент</th>
              <th style={{ width: '20%' }}>Сотрудник</th>
              <th style={{ width: '18%' }}>Отдел</th>
              <th>Начало</th>
              <th>Ожидание</th>
              <th style={{ textAlign: 'right' }}>Длительность</th>
              <th style={{ width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading && calls.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                  <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 8px' }} />
                  Загрузка списка звонков...
                </td>
              </tr>
            ) : Object.keys(groupedCalls).length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
                  Звонков за выбранный период не найдено
                </td>
              </tr>
            ) : (
              Object.entries(groupedCalls).map(([dayHeader, dayCalls]) => (
                <React.Fragment key={dayHeader}>
                  <tr className="date-row">
                    <td colSpan={7}>{dayHeader}</td>
                  </tr>
                  {dayCalls.map((c) => {
                    const isCallerSelected = currentCall?.id === c.id;
                    const callerDisplay = c.caller || c.caller_raw || 'Не определён';
                    const employeeLabel = getEmployeeLabel(c);
                    const sectorDisplay = c.sector_name || (c.sector ? `Сектор ${c.sector}` : '—');
                    const isIncoming = c.outcome === 'answered' && !c.initiated_by;
                    const isMissed =
                      c.outcome === 'abandoned_menu' ||
                      c.outcome === 'abandoned_queue' ||
                      c.outcome === 'message_afterhours' ||
                      c.outcome === 'message_queue_full' ||
                      c.outcome === 'message_no_answer';
                    const isOutgoing = !!c.initiated_by;

                    return (
                      <tr
                        key={c.id}
                        className={`data-row ${isCallerSelected ? 'active-row' : ''}`}
                        onClick={() => setSelectedCallId(c.id)}
                      >
                        <td>
                          <div className="cell-icon">
                            {isMissed ? (
                              <ArrowDownRight className="arrow miss" />
                            ) : isOutgoing ? (
                              <ArrowUpRight className="arrow out" />
                            ) : (
                              <ArrowDownLeft className="arrow in" />
                            )}
                            <span>{callerDisplay}</span>
                          </div>
                        </td>
                        <td>
                          <span className="link" onClick={(e) => { e.stopPropagation(); setSelectedCallId(c.id); }}>
                            {employeeLabel}
                          </span>
                        </td>
                        <td>{sectorDisplay}</td>
                        <td>{formatTime(c.started_at)}</td>
                        <td>{formatDuration(c.wait_seconds)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {c.ended_at === null ? (
                            <span className="badge badge-warning">В процессе</span>
                          ) : isMissed ? (
                            <span className="badge badge-danger">
                              {c.has_message ? 'голосовое' : 'до дозвона'}
                            </span>
                          ) : (
                            formatDuration(c.talk_seconds)
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {(c.has_recording || c.has_message) && (
                            <button
                              className="btn"
                              style={{ padding: 6, borderRadius: '50%', border: 'none' }}
                              title="Прослушать запись"
                              onClick={() => playCall(c)}
                            >
                              <Play size={14} style={{ marginLeft: 1 }} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>

        {/* Пагинация */}
        {total > pageSize && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Показано {pageOffset + 1}–{Math.min(pageOffset + pageSize, total)} из {total}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                disabled={pageOffset === 0}
                onClick={() => setPageOffset(Math.max(0, pageOffset - pageSize))}
              >
                <ChevronLeft size={16} /> Назад
              </button>
              <button
                className="btn"
                disabled={pageOffset + pageSize >= total}
                onClick={() => setPageOffset(pageOffset + pageSize)}
              >
                Вперёд <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Карточка звонка (Drawer) */}
      <CallDrawer
        callId={selectedCallId}
        onClose={() => setSelectedCallId(null)}
      />
    </div>
  );
}
