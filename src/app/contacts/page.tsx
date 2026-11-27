'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthContext';
import { ContactItem, ContactsPage, ContactSkipBotResponse } from '@/types/telephony';
import { apiFetch, extractApiError } from '@/lib/api-client';
import { formatDateTimeFull } from '@/lib/date-utils';
import {
  BookUser,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Lock,
  Phone,
} from 'lucide-react';

export default function ContactsPageView() {
  const { hasRole } = useAuth();
  const canManage = hasRole('manager', 'admin');

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [offset, setOffset] = useState<number>(0);
  const limit = 50;

  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [manualRefreshing, setManualRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);

  const [togglingIds, setTogglingIds] = useState<Record<number, boolean>>({});
  const [pendingAsteriskIds, setPendingAsteriskIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const fetchContacts = useCallback(async () => {
    if (!canManage) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (debouncedQuery) {
      params.set('q', debouncedQuery);
    }

    try {
      const res = await apiFetch(`/api/contacts?${params.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
      });

      if (res.status === 403) {
        setError('Нет доступа: справочник контактов доступен только ролям manager и admin.');
        setContacts([]);
        setTotal(0);
        return;
      }

      if (!res.ok) {
        const msg = await extractApiError(res, `Ошибка загрузки контактов (${res.status})`);
        setError(msg);
        return;
      }

      const data: ContactsPage = await res.json();
      setContacts(data.items || []);
      setTotal(data.total || 0);
      setSyncedAt(data.synced_at ?? null);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError('Не удалось загрузить справочник контактов');
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [canManage, offset, debouncedQuery]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  if (!canManage) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <Lock size={32} style={{ color: 'var(--miss)', margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)', marginBottom: 6 }}>
          Доступ запрещён
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Справочник контактов доступен только пользователям с ролью <b>manager</b> или <b>admin</b>.
        </p>
      </div>
    );
  }

  const handleToggleSkipBot = async (contact: ContactItem) => {
    const nextValue = !contact.skip_bot;
    setTogglingIds((prev) => ({ ...prev, [contact.id]: true }));
    setError(null);

    try {
      const res = await apiFetch(`/api/contacts/${contact.id}/skip-bot`, {
        method: 'PUT',
        body: JSON.stringify({ skip_bot: nextValue }),
      });

      if (res.status === 403) {
        setError('Нет доступа для изменения метки «Пропускать Асю»');
        return;
      }

      if (!res.ok) {
        const msg = await extractApiError(res, `Ошибка сохранения метки (${res.status})`);
        setError(msg);
        return;
      }

      const data: ContactSkipBotResponse = await res.json();
      const savedValue = typeof data.skip_bot === 'boolean' ? data.skip_bot : nextValue;

      setContacts((prev) =>
        prev.map((item) => (item.id === contact.id ? { ...item, skip_bot: savedValue } : item))
      );

      if (data.applied === false) {
        setPendingAsteriskIds((prev) => ({ ...prev, [contact.id]: true }));
        setNotice({
          type: 'warning',
          text: `Для «${contact.name}» метка сохранена, применение в Asterisk ожидается.`,
        });
      } else {
        setPendingAsteriskIds((prev) => {
          const copy = { ...prev };
          delete copy[contact.id];
          return copy;
        });
        setNotice({
          type: 'success',
          text: `Для «${contact.name}» метка «Пропускать Асю» ${savedValue ? 'включена' : 'выключена'}.`,
        });
      }
    } catch {
      setError('Не удалось обновить метку «Пропускать Асю»');
    } finally {
      setTogglingIds((prev) => {
        const copy = { ...prev };
        delete copy[contact.id];
        return copy;
      });
    }
  };

  return (
    <div>
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookUser size={18} style={{ color: 'var(--primary)' }} />
            Справочник контактов Bitrix24
          </h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {syncedAt ? `Синхронизировано: ${formatDateTimeFull(syncedAt)}` : 'Управление правилом «Пропускать Асю» для контактов'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="search" style={{ marginLeft: 0 }}>
            <input
              placeholder="Поиск по имени или номеру..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setDebouncedQuery(searchInput.trim());
                  setOffset(0);
                }
              }}
            />
            <Search size={16} />
          </div>

          <button
            className="btn"
            disabled={loading || manualRefreshing}
            onClick={async () => {
              setManualRefreshing(true);
              try {
                await fetchContacts();
              } finally {
                setTimeout(() => setManualRefreshing(false), 450);
              }
            }}
          >
            <RefreshCw size={14} className={loading || manualRefreshing ? 'animate-spin' : ''} />{' '}
            {manualRefreshing ? 'Обновление...' : 'Обновить'}
          </button>
        </div>
      </div>

      {notice && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: notice.type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            color: notice.type === 'warning' ? 'var(--wait)' : 'var(--out)',
            border: notice.type === 'warning' ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(34, 197, 94, 0.3)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
          }}
        >
          {notice.type === 'warning' ? <Clock size={18} /> : <CheckCircle2 size={18} />}
          <span>{notice.text}</span>
        </div>
      )}

      {error && (
        <div
          className="info-banner"
          style={{ background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
        >
          <AlertCircle size={20} style={{ stroke: 'var(--miss)', flexShrink: 0 }} />
          <p style={{ color: 'var(--miss)' }}>{error}</p>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Контакт</th>
              <th style={{ width: '35%' }}>Телефоны</th>
              <th style={{ width: '30%', textAlign: 'right' }}>Пропускать Асю</th>
            </tr>
          </thead>
          <tbody>
            {loading && contacts.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                  <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 8px' }} />
                  Загрузка контактов...
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '44px 0', color: 'var(--muted)' }}>
                  Контакты не найдены
                </td>
              </tr>
            ) : (
              contacts.map((contact) => {
                const isUpdating = !!togglingIds[contact.id];
                const isPendingApply = !!pendingAsteriskIds[contact.id];
                return (
                  <tr key={contact.id} className="data-row">
                    <td>
                      <b style={{ color: 'var(--dark)', display: 'block' }}>{contact.name || `Контакт #${contact.id}`}</b>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>ID: #{contact.id}</span>
                    </td>
                    <td>
                      {contact.phones && contact.phones.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {contact.phones.map((phone, idx) => (
                            <span
                              key={`${contact.id}-${idx}`}
                              className="badge badge-neutral"
                              style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                            >
                              <Phone size={11} style={{ marginRight: 4 }} />
                              {phone}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        {isPendingApply && (
                          <span className="badge badge-warning" style={{ fontSize: 11 }}>
                            Ожидает Asterisk
                          </span>
                        )}
                        <button
                          type="button"
                          className={`btn ${contact.skip_bot ? 'btn-primary' : ''}`}
                          disabled={isUpdating}
                          onClick={() => handleToggleSkipBot(contact)}
                          style={{ minWidth: 112, justifyContent: 'center', padding: '6px 12px', fontSize: 12 }}
                        >
                          {isUpdating ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : contact.skip_bot ? (
                            'Включено'
                          ) : (
                            'Выключено'
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {total > limit && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Показано {offset + 1}–{Math.min(offset + limit, total)} из {total}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                <ChevronLeft size={16} /> Назад
              </button>
              <button
                className="btn"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Вперёд <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
