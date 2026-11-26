'use client';

import React, { useEffect, useState } from 'react';
import { CallDetail } from '@/types/telephony';
import { useAudioPlayer } from './AudioPlayerContext';
import { formatDuration, formatDateTimeFull } from '@/lib/date-utils';
import { getEmployeeLabel } from '@/lib/departments-filter';
import { apiFetch, extractApiError } from '@/lib/api-client';
import { X, Play, Volume2, Bot, MessageSquare, Send, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface CallDrawerProps {
  callId: number | null;
  onClose: () => void;
}

export default function CallDrawer({ callId, onClose }: CallDrawerProps) {
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { playCall } = useAudioPlayer();

  const fetchCallDetail = async (id: number) => {
    try {
      const res = await apiFetch(`/api/calls/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Звонок не найден в базе');
        }
        if (res.status === 403) {
          throw new Error('Нет доступа к просмотру карточки звонка');
        }
        throw new Error(await extractApiError(res, `Ошибка сервера (${res.status})`));
      }
      const data: CallDetail = await res.json();
      setDetail(data);
      setError(null);
      return data;
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных звонка');
      return null;
    }
  };

  useEffect(() => {
    if (!callId) {
      setDetail(null);
      setError(null);
      return;
    }

    setLoading(true);
    fetchCallDetail(callId).finally(() => setLoading(false));

    // Поллинг каждые 7 секунд, если звонок еще обрабатывается ИИ
    const interval = setInterval(async () => {
      const current = await fetchCallDetail(callId);
      if (
        current &&
        current.transcription_status !== 'processing' &&
        current.transcription_status !== 'submitting' &&
        current.summary_status !== 'pending' &&
        current.bitrix_routing_status !== 'pending'
      ) {
        clearInterval(interval);
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [callId]);

  if (!callId) return null;

  const parseTranscript = (rawText: string | null) => {
    if (!rawText) return [];
    return rawText.split('\n').filter((line) => line.trim().length > 0).map((line, idx) => {
      // Пример формата: "[00:04] Клиент: Добрый день..."
      const matchWithTime = line.match(/^(\[\d{2}:\d{2}\])\s*(Клиент|Сотрудник|Оператор)?:\s*(.+)$/i);
      if (matchWithTime) {
        return {
          id: idx,
          time: matchWithTime[1],
          speaker: matchWithTime[2] || 'Клиент',
          text: matchWithTime[3],
        };
      }
      const matchNoTime = line.match(/^(Клиент|Сотрудник|Оператор):\s*(.+)$/i);
      if (matchNoTime) {
        return {
          id: idx,
          time: '',
          speaker: matchNoTime[1],
          text: matchNoTime[2],
        };
      }
      return {
        id: idx,
        time: '',
        speaker: 'Реплика',
        text: line,
      };
    });
  };

  const callerNumber = detail?.caller || detail?.caller_raw || 'Не определён';
  const startedAtFormatted = detail ? formatDateTimeFull(detail.started_at) : '';

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title">
            <h2>Карточка звонка #{callId}</h2>
            <p>{callerNumber} · {startedAtFormatted}</p>
          </div>
          <button className="close-btn" onClick={onClose} title="Закрыть">
            <X size={18} />
          </button>
        </div>

        {loading && !detail && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
            <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 12px' }} />
            Загрузка карточки звонка...
          </div>
        )}

        {error && (
          <div className="card" style={{ borderColor: 'var(--miss)', background: 'var(--soft)' }}>
            <p style={{ color: 'var(--miss)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} /> {error}
            </p>
          </div>
        )}

        {detail && (
          <>
            {/* Основная сводка */}
            <div className="card" style={{ margin: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Сотрудник</div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>
                    {getEmployeeLabel(detail)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Отдел</div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>
                    {detail.sector_name || (detail.sector ? `Сектор ${detail.sector}` : '—')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Ожидание</div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>
                    {formatDuration(detail.wait_seconds)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Длительность</div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>
                    {detail.ended_at === null ? (
                      <span className="badge badge-warning">В процессе</span>
                    ) : (
                      formatDuration(detail.talk_seconds)
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Дорожки аудиозаписи */}
            <div className="detail-section">
              <h3><Volume2 size={18} /> Аудиозапись</h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {detail.has_recording && (
                  <button
                    className="btn btn-primary"
                    onClick={() => playCall(detail, 'mix')}
                  >
                    <Play size={14} /> Общая запись (Mix)
                  </button>
                )}
                {detail.has_recording && (
                  <button
                    className="btn"
                    onClick={() => playCall(detail, 'client')}
                  >
                    <Play size={14} /> Дорожка клиента
                  </button>
                )}
                {detail.has_recording && (
                  <button
                    className="btn"
                    onClick={() => playCall(detail, 'staff')}
                  >
                    <Play size={14} /> Дорожка сотрудника
                  </button>
                )}
                {detail.has_message && (
                  <button
                    className="btn btn-primary"
                    onClick={() => playCall(detail, 'message')}
                  >
                    <Play size={14} /> Голосовое сообщение
                  </button>
                )}
                {!detail.has_recording && !detail.has_message && (
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {detail.voicemail_left ? 'Сообщение было оставлено, но запись уже удалена' : 'Запись отсутствует'}
                  </span>
                )}
              </div>
            </div>

            {/* ИИ Выжимка (YandexGPT) */}
            <div className="detail-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3><Bot size={18} /> Выжимка разговора (YandexGPT)</h3>
                {detail.summary_status === 'completed' && <span className="badge badge-success">Готово</span>}
                {detail.summary_status === 'pending' && <span className="badge badge-warning">Обработка...</span>}
                {detail.summary_status === 'skipped' && <span className="badge badge-neutral">Пропущено</span>}
                {detail.summary_status === 'failed' && <span className="badge badge-danger">Ошибка</span>}
              </div>

              {detail.summary ? (
                <div className="summary-card">
                  <div className="summary-item">
                    <b>Суть обращения:</b>
                    <span>{detail.summary.topic || '—'}</span>
                  </div>

                  {detail.summary.agreements && detail.summary.agreements.length > 0 && (
                    <div className="summary-item">
                      <b>Договорённости:</b>
                      <ul>
                        {detail.summary.agreements.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detail.summary.next_steps && detail.summary.next_steps.length > 0 && (
                    <div className="summary-item">
                      <b>Следующие действия:</b>
                      <ul>
                        {detail.summary.next_steps.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detail.summary.deal_code && (
                    <div className="summary-item" style={{ marginTop: 6 }}>
                      <b>Код сделки:</b>
                      <span className="badge badge-success" style={{ fontSize: 12, marginTop: 4 }}>
                        {detail.summary.deal_code}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="summary-card" style={{ color: 'var(--muted)' }}>
                  {detail.summary_status === 'pending'
                    ? 'Нейросеть составляет выжимку разговора...'
                    : 'Выжимка не формировалась для этого звонка.'}
                </div>
              )}
            </div>

            {/* Расшифровка (Yandex SpeechKit) */}
            <div className="detail-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3><MessageSquare size={18} /> Расшифровка диалога (SpeechKit)</h3>
                {detail.transcription_status === 'completed' && <span className="badge badge-success">Распознано</span>}
                {detail.transcription_status === 'processing' && <span className="badge badge-warning">Распознаётся...</span>}
                {detail.transcription_status === 'failed' && <span className="badge badge-danger">Ошибка</span>}
              </div>

              {detail.transcript ? (
                <div className="chat-transcript">
                  {parseTranscript(detail.transcript).map((line) => {
                    const isClient = line.speaker.toLowerCase().includes('клиент');
                    return (
                      <div
                        key={line.id}
                        className={`chat-bubble ${isClient ? 'client' : 'staff'}`}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>
                          {line.time && <span className="chat-time">{line.time}</span>}
                          {line.speaker}
                        </div>
                        <div>{line.text}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="summary-card" style={{ color: 'var(--muted)' }}>
                  {detail.transcription_status === 'processing' || detail.transcription_status === 'submitting'
                    ? 'Аудиозапись передана в Yandex SpeechKit для распознавания...'
                    : 'Текст диалога отсутствует.'}
                </div>
              )}
            </div>

            {/* Доставка в Bitrix24 */}
            <div className="detail-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3><Send size={18} /> Доставка в Bitrix24</h3>
                {detail.bitrix_routing_status === 'resolved' && <span className="badge badge-success">Маршрут найден</span>}
                {detail.bitrix_routing_status === 'failed' && <span className="badge badge-danger">Ошибка</span>}
                {detail.bitrix_routing_status === 'skipped' && <span className="badge badge-neutral">Адресаты не найдены</span>}
              </div>

              {detail.bitrix_deliveries && detail.bitrix_deliveries.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.bitrix_deliveries.map((del, idx) => (
                    <div
                      key={idx}
                      className="card"
                      style={{ padding: '12px 16px', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <b style={{ textTransform: 'capitalize' }}>
                          {del.destination === 'deal' && 'Сделка в CRM'}
                          {del.destination === 'chat' && 'Личное сообщение сотруднику'}
                          {del.destination === 'contact' && 'Контакт в CRM'}
                          {del.destination === 'company' && 'Компания в CRM'}
                        </b>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          ID получателя: {del.target_id} {del.external_id ? `· ID сообщения/комментария: ${del.external_id}` : ''}
                        </div>
                        {del.last_error && (
                          <div style={{ fontSize: 11, color: 'var(--miss)', marginTop: 2 }}>
                            {del.last_error}
                          </div>
                        )}
                      </div>
                      <div>
                        {del.status === 'sent' && <span className="badge badge-success">Отправлено</span>}
                        {del.status === 'sending' && <span className="badge badge-warning">Отправка</span>}
                        {del.status === 'pending' && <span className="badge badge-neutral">В очереди</span>}
                        {del.status === 'uncertain' && <span className="badge badge-warning">Не подтверждена</span>}
                        {del.status === 'failed' && <span className="badge badge-danger">Ошибка</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="summary-card" style={{ color: 'var(--muted)' }}>
                  {detail.bitrix_routing_status === 'skipped'
                    ? 'Адресаты для отправки выжимки в Bitrix24 не найдены.'
                    : 'Задач доставки в Bitrix24 для этого звонка нет.'}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
