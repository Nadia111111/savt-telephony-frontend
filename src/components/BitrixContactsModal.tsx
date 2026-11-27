'use client';

import React, { useState, useCallback } from 'react';
import { CallContactMatch, CallContactsResponse } from '@/types/telephony';
import { apiFetch, extractApiError } from '@/lib/api-client';
import { ExternalLink, X, Users, AlertCircle } from 'lucide-react';

export type CallContactsModalState = {
  callId: number;
  callerLabel: string;
  items: CallContactMatch[];
  error?: string | null;
} | null;

export function useCallContactsLookup() {
  const [loadingCallId, setLoadingCallId] = useState<number | null>(null);
  const [modalState, setModalState] = useState<CallContactsModalState>(null);

  const lookupCallContacts = useCallback(async (callId: number, callerLabel: string) => {
    setLoadingCallId(callId);
    try {
      const res = await apiFetch(`/api/calls/${callId}/contacts`, { cache: 'no-store' });
      if (res.status === 403) {
        setModalState({
          callId,
          callerLabel,
          items: [],
          error: 'Нет доступа к поиску контактов в Bitrix24',
        });
        return;
      }
      if (!res.ok) {
        const msg = await extractApiError(res, `Ошибка поиска в Bitrix24 (${res.status})`);
        setModalState({
          callId,
          callerLabel,
          items: [],
          error: msg,
        });
        return;
      }

      const data: CallContactsResponse = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];

      if (items.length === 1 && items[0]?.url) {
        const opened = window.open(items[0].url, '_blank', 'noopener,noreferrer');
        if (opened) {
          return;
        }
        // Fallback modal if browser blocks async popup
        setModalState({ callId, callerLabel, items });
        return;
      }

      setModalState({ callId, callerLabel, items });
    } catch {
      setModalState({
        callId,
        callerLabel,
        items: [],
        error: 'Не удалось выполнить поиск контактов в Bitrix24',
      });
    } finally {
      setLoadingCallId((prev) => (prev === callId ? null : prev));
    }
  }, []);

  return {
    loadingCallId,
    modalState,
    closeModal: () => setModalState(null),
    lookupCallContacts,
  };
}

export function BitrixContactsModal({
  state,
  onClose,
}: {
  state: CallContactsModalState;
  onClose: () => void;
}) {
  if (!state) return null;

  return (
    <div
      className="drawer-overlay"
      style={{ alignItems: 'center', justifyContent: 'center', zIndex: 120 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 460, margin: 16, padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: 'var(--primary)' }} />
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)' }}>
                Карточки Bitrix24
              </h2>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                Номер: {state.callerLabel} (звонок #{state.callId})
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} title="Закрыть">
            <X size={16} />
          </button>
        </div>

        {state.error ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--miss)',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{state.error}</span>
          </div>
        ) : state.items.length === 0 ? (
          <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Совпадений в Bitrix24 для этого номера не найдено.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.items.map((item, idx) => (
              <a
                key={item.id ?? idx}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card"
                style={{
                  margin: 0,
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'border-color .15s ease, background .15s ease',
                }}
              >
                <div>
                  <b style={{ fontSize: 14, color: 'var(--dark)', display: 'block' }}>
                    {item.name || `Контакт #${item.id ?? idx + 1}`}
                  </b>
                  {item.phones && item.phones.length > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {item.phones.join(', ')}
                    </span>
                  )}
                </div>
                <span className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                  Открыть <ExternalLink size={13} />
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
