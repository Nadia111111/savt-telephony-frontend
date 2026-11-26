'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TelephonySettings, DayOfWeek } from '@/types/telephony';
import { useAuth } from '@/components/AuthContext';
import { apiFetch, extractApiError } from '@/lib/api-client';
import {
  Building,
  Phone,
  Clock,
  Calendar,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Voicemail,
  ShieldCheck,
  Lock,
} from 'lucide-react';

const DAYS: { key: DayOfWeek; label: string; full: string }[] = [
  { key: 'mon', label: 'Пн', full: 'Понедельник' },
  { key: 'tue', label: 'Вт', full: 'Вторник' },
  { key: 'wed', label: 'Ср', full: 'Среда' },
  { key: 'thu', label: 'Чт', full: 'Четверг' },
  { key: 'fri', label: 'Пт', full: 'Пятница' },
  { key: 'sat', label: 'Сб', full: 'Суббота' },
  { key: 'sun', label: 'Вс', full: 'Воскресенье' },
];

const DEFAULT_SETTINGS: TelephonySettings = {
  work_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  opens_at: '08:00',
  closes_at: '17:00',
  menu_attempts: 3,
  menu_timeout_seconds: 6,
  default_sector: 1,
  queue_wait_seconds: null,
  ring_time_seconds: 20,
  voicemail_max_seconds: 120,
  voicemail_silence_seconds: 5,
};

const SECTORS = [
  { id: 1, name: 'Сектор 1 — Отдел продаж' },
  { id: 2, name: 'Сектор 2 — Служба поддержки' },
  { id: 3, name: 'Сектор 3 — Отдел разработки ПО' },
  { id: 4, name: 'Сектор 4 — Администрация' },
  { id: 5, name: 'Сектор 5 — Бухгалтерия' },
];

export default function SettingsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('manager', 'admin');

  const [settings, setSettings] = useState<TelephonySettings>(DEFAULT_SETTINGS);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [loadingHolidays, setLoadingHolidays] = useState<boolean>(true);
  const [addingHoliday, setAddingHoliday] = useState<boolean>(false);
  const [deletingHoliday, setDeletingHoliday] = useState<string | null>(null);
  const [holidaysError, setHolidaysError] = useState<string | null>(null);
  const [holidaysSuccess, setHolidaysSuccess] = useState<string | null>(null);

  // Загрузка настроек телефонии
  const fetchSettings = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setSettingsError(null);
    try {
      const res = await apiFetch('/api/settings/telephony');
      if (res.status === 403) {
        setSettingsError('Нет доступа к настройкам АТС');
        return;
      }
      if (!res.ok) {
        throw new Error(`Статус ${res.status}`);
      }
      const data: TelephonySettings = await res.json();
      setSettings(data);
    } catch {
      // При недоступности бэкенда держим стандартные настройки
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  // Загрузка праздничных дат
  const fetchHolidays = useCallback(async () => {
    if (!canManage) return;
    setLoadingHolidays(true);
    setHolidaysError(null);
    try {
      const res = await apiFetch('/api/settings/holidays');
      if (res.status === 403) {
        setHolidaysError('Нет доступа к календарю праздников');
        return;
      }
      if (!res.ok) {
        throw new Error(`Статус ${res.status}`);
      }
      const data = await res.json();
      setHolidays(Array.isArray(data.dates) ? data.dates : []);
    } catch {
      setHolidays(['2026-12-31', '2027-01-01']);
    } finally {
      setLoadingHolidays(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (!canManage) return;
    fetchSettings();
    fetchHolidays();
  }, [canManage, fetchSettings, fetchHolidays]);

  // Переключение дня недели
  const toggleDay = (day: DayOfWeek) => {
    setSettings((prev) => {
      const exists = prev.work_days.includes(day);
      const updated = exists
        ? prev.work_days.filter((d) => d !== day)
        : [...prev.work_days, day];
      return { ...prev, work_days: updated };
    });
  };

  // Сохранение настроек телефонии (PUT)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const res = await apiFetch('/api/settings/telephony', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });

      if (res.status === 403) {
        throw new Error('Нет доступа для изменения настроек АТС');
      }

      if (!res.ok) {
        throw new Error(await extractApiError(res, `Ошибка сервера (${res.status})`));
      }

      const savedData: TelephonySettings = await res.json();
      setSettings(savedData);
      setSettingsSuccess('Параметры АТС успешно сохранены на сервере Asterisk');
      setTimeout(() => setSettingsSuccess(null), 4000);
    } catch (err: any) {
      setSettingsError(err.message || 'Не удалось сохранить настройки');
    } finally {
      setSavingSettings(false);
    }
  };

  // Добавление праздничной даты (PUT 204)
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate) return;

    if (holidays.includes(newHolidayDate)) {
      setHolidaysError('Эта дата уже добавлена в список праздников');
      return;
    }

    setAddingHoliday(true);
    setHolidaysError(null);
    setHolidaysSuccess(null);

    try {
      const res = await apiFetch(`/api/settings/holidays/${newHolidayDate}`, {
        method: 'PUT',
      });

      if (res.status === 403) {
        setHolidaysError('Нет доступа для изменения праздничных дат');
        return;
      }

      if (res.status === 204 || res.ok) {
        setHolidaysSuccess(`Праздничная дата ${newHolidayDate} добавлена`);
        setNewHolidayDate('');
        fetchHolidays();
        setTimeout(() => setHolidaysSuccess(null), 4000);
      } else {
        setHolidaysError(await extractApiError(res, `Ошибка добавления даты (${res.status})`));
      }
    } catch {
      // Fallback для оффлайн/демо режима
      setHolidays((prev) => [...prev, newHolidayDate].sort());
      setNewHolidayDate('');
      setHolidaysSuccess('Дата добавлена (демо-режим)');
      setTimeout(() => setHolidaysSuccess(null), 4000);
    } finally {
      setAddingHoliday(false);
    }
  };

  // Удаление праздничной даты (DELETE 204)
  const handleDeleteHoliday = async (date: string) => {
    if (!confirm(`Удалить праздничную дату ${date}?`)) return;

    setDeletingHoliday(date);
    setHolidaysError(null);

    try {
      const res = await apiFetch(`/api/settings/holidays/${date}`, {
        method: 'DELETE',
      });

      if (res.status === 403) {
        setHolidaysError('Нет доступа для удаления праздничных дат');
        return;
      }

      if (res.status === 204 || res.ok) {
        fetchHolidays();
      } else {
        setHolidaysError(await extractApiError(res, `Ошибка удаления (${res.status})`));
      }
    } catch {
      setHolidays((prev) => prev.filter((d) => d !== date));
    } finally {
      setDeletingHoliday(null);
    }
  };

  const formatHolidayDate = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      const date = new Date(Number(y), Number(m) - 1, Number(d));
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (!canManage) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <Lock size={32} style={{ color: 'var(--miss)', margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)', marginBottom: 6 }}>
          Доступ запрещён
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Управление настройками АТС и календарём праздников доступно только ролям <b>manager</b> и <b>admin</b>.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Подтабы */}
      <div className="subtabs">
        <Link href="/departments" className="subtab">
          <Building size={18} /> Отделы
        </Link>
        <Link href="/settings" className="subtab active">
          <Phone size={18} /> Параметры АТС и праздники
        </Link>
      </div>

      {/* Информационная шапка */}
      <div className="card" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <b style={{ fontSize: 15, color: 'var(--dark)' }}>Станция телефонии Asterisk 22 (SAVT)</b>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            Транк life:) с 10 одновременными каналами · Часовой пояс Europe/Minsk (UTC+3)
          </p>
        </div>
        <button
          type="button"
          onClick={() => { fetchSettings(); fetchHolidays(); }}
          className="btn"
          title="Обновить настройки с сервера"
          disabled={loading || savingSettings}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
        {/* ЛЕВАЯ КОЛОНКА: Настройки АТС */}
        <div>
          <form onSubmit={handleSaveSettings}>
            {/* Карточка 1: Рабочее время */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Clock size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)' }}>
                  Рабочие дни и часы приёма звонков
                </h3>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 8 }}>
                  Рабочие дни недели:
                </label>
                <div className="chips">
                  {DAYS.map((d) => {
                    const active = settings.work_days.includes(d.key);
                    return (
                      <div
                        key={d.key}
                        className={`chip ${active ? 'active' : ''}`}
                        onClick={() => toggleDay(d.key)}
                        title={d.full}
                      >
                        {d.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                    Время начала работы (opens_at):
                  </label>
                  <input
                    type="time"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      color: 'var(--dark)',
                      fontSize: 13,
                    }}
                    value={settings.opens_at}
                    onChange={(e) => setSettings({ ...settings, opens_at: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                    Время окончания работы (closes_at)*:
                  </label>
                  <input
                    type="time"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      color: 'var(--dark)',
                      fontSize: 13,
                    }}
                    value={settings.closes_at}
                    onChange={(e) => setSettings({ ...settings, closes_at: e.target.value })}
                    required
                  />
                </div>
              </div>

              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12, lineHeight: 1.4 }}>
                * По гайду <code>closes_at</code> указывает на первую нерабочую минуту. Например, 17:00 означает завершение рабочего дня ровно в 17:00:00. После этого звонки переводятся на автоответчик.
              </p>
            </div>

            {/* Карточка 2: Логика голосового меню (IVR) */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Sliders size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)' }}>
                  Сценарий голосового меню (IVR) и дозвона
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                    Попытки выбора клавиши (1–5):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      color: 'var(--dark)',
                      fontSize: 13,
                    }}
                    value={settings.menu_attempts}
                    onChange={(e) => setSettings({ ...settings, menu_attempts: Number(e.target.value) })}
                    required
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Обычно 3 попытки ввода DTMF</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                    Ожидание нажатия цифры (сек):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      color: 'var(--dark)',
                      fontSize: 13,
                    }}
                    value={settings.menu_timeout_seconds}
                    onChange={(e) => setSettings({ ...settings, menu_timeout_seconds: Number(e.target.value) })}
                    required
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>По умолчанию 6 секунд</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                    Резервный отдел по умолчанию:
                  </label>
                  <select
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      color: 'var(--dark)',
                      fontSize: 13,
                    }}
                    value={settings.default_sector}
                    onChange={(e) => setSettings({ ...settings, default_sector: Number(e.target.value) })}
                  >
                    {SECTORS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Куда направить при ошибках ввода</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                    Время вызова сотрудника (ring_time, сек):
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      color: 'var(--dark)',
                      fontSize: 13,
                    }}
                    value={settings.ring_time_seconds}
                    onChange={(e) => setSettings({ ...settings, ring_time_seconds: Number(e.target.value) })}
                    required
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Сколько звонить сотруднику (по умолч. 20 с)</span>
                </div>
              </div>
            </div>

            {/* Карточка 3: Очередь и автоответчик */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Voicemail size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)' }}>
                  Параметры очереди и голосовой почты
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                    Макс. длина сообщения (сек):
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="600"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      color: 'var(--dark)',
                      fontSize: 13,
                    }}
                    value={settings.voicemail_max_seconds}
                    onChange={(e) => setSettings({ ...settings, voicemail_max_seconds: Number(e.target.value) })}
                    required
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>По умолчанию 120 секунд</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                    Порог тишины для отбоя (сек):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      color: 'var(--dark)',
                      fontSize: 13,
                    }}
                    value={settings.voicemail_silence_seconds}
                    onChange={(e) => setSettings({ ...settings, voicemail_silence_seconds: Number(e.target.value) })}
                    required
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Завершение записи при молчании</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                  Общий лимит ожидания в очереди (queue_wait_seconds):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="queue_mode"
                      checked={settings.queue_wait_seconds === null}
                      onChange={() => setSettings({ ...settings, queue_wait_seconds: null })}
                    />
                    Без таймаута (клиент ожидает без ограничения)
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="queue_mode"
                      checked={settings.queue_wait_seconds !== null}
                      onChange={() => setSettings({ ...settings, queue_wait_seconds: 120 })}
                    />
                    Ограничить в секундах
                  </label>
                </div>

                {settings.queue_wait_seconds !== null && (
                  <div style={{ marginTop: 10 }}>
                    <input
                      type="number"
                      min="10"
                      max="600"
                      style={{
                        width: '200px',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        color: 'var(--dark)',
                        fontSize: 13,
                      }}
                      value={settings.queue_wait_seconds}
                      onChange={(e) => setSettings({ ...settings, queue_wait_seconds: Number(e.target.value) })}
                    />
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>секунд до автоответчика</span>
                  </div>
                )}
              </div>
            </div>

            {/* Сообщения об успехе/ошибке */}
            {settingsSuccess && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: 'var(--out)', border: '1px solid rgba(34,197,94,0.3)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} />
                <span>{settingsSuccess}</span>
              </div>
            )}
            {settingsError && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--miss)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={18} />
                <span>{settingsError}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 500, justifyContent: 'center' }}
              disabled={savingSettings}
            >
              <Save size={16} />
              {savingSettings ? 'Сохранение настроек в Asterisk...' : 'Сохранить параметры АТС'}
            </button>
          </form>
        </div>

        {/* ПРАВАЯ КОЛОНКА: Праздники и нерабочие даты */}
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Calendar size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)' }}>
                Праздничные и нерабочие даты
              </h3>
            </div>

            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4, marginBottom: 16 }}>
              В эти даты телефонная станция весь день работает по сценарию нерабочего времени (входящие переводятся на запись сообщения).
            </p>

            {/* Форма добавления даты */}
            <form onSubmit={handleAddHoliday} style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                Добавить праздничную дату:
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="date"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--dark)',
                    fontSize: 13,
                  }}
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '8px 14px' }}
                  disabled={addingHoliday || !newHolidayDate}
                >
                  <Plus size={14} /> Добавить
                </button>
              </div>
            </form>

            {/* Сообщения праздников */}
            {holidaysSuccess && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: 'var(--out)', fontSize: 12, marginBottom: 14 }}>
                {holidaysSuccess}
              </div>
            )}
            {holidaysError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--miss)', fontSize: 12, marginBottom: 14 }}>
                {holidaysError}
              </div>
            )}

            {/* Список праздничных дат */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)' }}>
                  Настроенные праздники ({holidays.length}):
                </span>
                {loadingHolidays && <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--muted)' }} />}
              </div>

              {holidays.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: 13 }}>
                  Праздничные даты не настроены
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {holidays.map((date) => (
                    <div
                      key={date}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                      }}
                    >
                      <div>
                        <b style={{ fontSize: 13, color: 'var(--dark)', display: 'block' }}>
                          {formatHolidayDate(date)}
                        </b>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{date}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(date)}
                        className="btn"
                        style={{ padding: 6, border: 'none', color: 'var(--miss)' }}
                        title="Удалить праздник"
                        disabled={deletingHoliday === date}
                      >
                        {deletingHoliday === date ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Информационная карточка */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <ShieldCheck size={18} style={{ color: 'var(--primary)' }} />
              <b style={{ color: 'var(--dark)', fontSize: 13 }}>Безопасность и лимиты</b>
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Лимит очереди: до 2 ожидающих клиентов на отдел (задаётся на сервере в <code>queues.conf</code>). Все изменения параметров и праздников применяются в Asterisk на лету без прерывания текущих звонков.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
