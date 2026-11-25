'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  DepartmentListItem,
  DepartmentDetail,
  DepartmentSettings,
  DepartmentsResponse,
} from '@/types/telephony';
import {
  Users,
  Building,
  Phone,
  Settings,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  X,
  PhoneCall,
  Save,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

const MOCK_DEPARTMENTS: DepartmentListItem[] = [
  {
    id: 1,
    name: 'Отдел продаж',
    parent_id: null,
    employee_count: 8,
    directory_present: true,
    call_status: 'in_call',
    active_calls: 2,
    settings: {
      sector: 1,
      primary_number: '+375296214062',
      additional_numbers: ['+375336317203'],
      busy_mode: 'queue',
      queue_wait_seconds: 120,
    },
  },
  {
    id: 2,
    name: 'Служба поддержки',
    parent_id: null,
    employee_count: 6,
    directory_present: true,
    call_status: 'idle',
    active_calls: 0,
    settings: {
      sector: 2,
      primary_number: '+375296038704',
      additional_numbers: [],
      busy_mode: 'queue',
      queue_wait_seconds: 180,
    },
  },
  {
    id: 3,
    name: 'Отдел разработки ПО',
    parent_id: null,
    employee_count: 5,
    directory_present: true,
    call_status: 'idle',
    active_calls: 0,
    settings: {
      sector: 3,
      primary_number: '+375296081350',
      additional_numbers: [],
      busy_mode: 'message',
      queue_wait_seconds: null,
    },
  },
  {
    id: 4,
    name: 'Администрация',
    parent_id: null,
    employee_count: 3,
    directory_present: true,
    call_status: 'idle',
    active_calls: 0,
    settings: {
      sector: 4,
      primary_number: '+375296105801',
      additional_numbers: [],
      busy_mode: 'queue',
      queue_wait_seconds: 60,
    },
  },
  {
    id: 5,
    name: 'Бухгалтерия',
    parent_id: null,
    employee_count: 2,
    directory_present: true,
    call_status: 'unconfigured',
    active_calls: null,
    settings: null,
  },
];

const MOCK_SECTORS = [
  { sector: 1, name: 'Сектор 1 (Отдел продаж)', bound_department_id: 1 },
  { sector: 2, name: 'Сектор 2 (Служба поддержки)', bound_department_id: 2 },
  { sector: 3, name: 'Сектор 3 (Отдел разработки ПО)', bound_department_id: 3 },
  { sector: 4, name: 'Сектор 4 (Администрация)', bound_department_id: 4 },
  { sector: 5, name: 'Сектор 5 (Бухгалтерия)', bound_department_id: null },
];

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentListItem[]>(MOCK_DEPARTMENTS);
  const [sectors, setSectors] = useState<any[]>(MOCK_SECTORS);
  const [settingsAvailable, setSettingsAvailable] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Выбранный отдел для боковой карточки
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [deptDetail, setDeptDetail] = useState<DepartmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Форма настроек
  const [formSector, setFormSector] = useState<number>(1);
  const [formPrimaryNumber, setFormPrimaryNumber] = useState<string>('');
  const [formAdditionalNumbers, setFormAdditionalNumbers] = useState<string[]>([]);
  const [formBusyMode, setFormBusyMode] = useState<'queue' | 'message'>('queue');
  const [formQueueWaitSeconds, setFormQueueWaitSeconds] = useState<number | null>(120);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Загрузка списка отделов
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/departments');
      if (!res.ok) {
        throw new Error(`Статус ответа ${res.status}`);
      }
      const data: DepartmentsResponse = await res.json();
      setDepartments(data.items || []);
      setSectors(data.sectors || []);
      setSettingsAvailable(data.settings_available ?? true);
      setBackendError(null);
    } catch (err: any) {
      setBackendError('Справочник Битрикс24 пока не запущен на сервере ВМ');
      // Оставляем демонстрационный список
      setDepartments(MOCK_DEPARTMENTS);
      setSectors(MOCK_SECTORS);
      setSettingsAvailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
    // Фоновое обновление статуса звонков каждые 15 секунд
    const interval = setInterval(fetchDepartments, 15000);
    return () => clearInterval(interval);
  }, [fetchDepartments]);

  // Загрузка детальной карточки отдела
  const openDepartmentCard = async (id: number) => {
    setSelectedDeptId(id);
    setDetailLoading(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const res = await fetch(`/api/departments/${id}`);
      if (!res.ok) throw new Error('Ошибка загрузки данных отдела');
      const data: DepartmentDetail = await res.json();
      setDeptDetail(data);
      populateForm(data.settings, data.id);
    } catch {
      // Fallback на локальный объект
      const local = departments.find((d) => d.id === id);
      if (local) {
        const mockDetail: DepartmentDetail = {
          ...local,
          employees: [
            { id: 101, name: 'Александр Долгополов', position: 'Руководитель', photo_url: null },
            { id: 102, name: 'Артём Горшков', position: 'Менеджер', photo_url: null },
            { id: 103, name: 'Анастасия Аксёнова', position: 'Специалист', photo_url: null },
          ],
          settings_available: settingsAvailable,
        };
        setDeptDetail(mockDetail);
        populateForm(local.settings, local.id);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const populateForm = (settings: DepartmentSettings | null, deptId: number) => {
    if (settings) {
      setFormSector(settings.sector);
      setFormPrimaryNumber(settings.primary_number || '');
      setFormAdditionalNumbers(settings.additional_numbers || []);
      setFormBusyMode(settings.busy_mode || 'queue');
      setFormQueueWaitSeconds(settings.queue_wait_seconds);
    } else {
      setFormSector(deptId <= 5 ? deptId : 1);
      setFormPrimaryNumber('');
      setFormAdditionalNumbers([]);
      setFormBusyMode('queue');
      setFormQueueWaitSeconds(120);
    }
  };

  // Добавление / удаление доп. номеров
  const handleAddNumber = () => {
    if (formAdditionalNumbers.length >= 9) return;
    setFormAdditionalNumbers([...formAdditionalNumbers, '']);
  };

  const handleUpdateAdditionalNumber = (index: number, value: string) => {
    const copy = [...formAdditionalNumbers];
    copy[index] = value;
    setFormAdditionalNumbers(copy);
  };

  const handleRemoveAdditionalNumber = (index: number) => {
    setFormAdditionalNumbers(formAdditionalNumbers.filter((_, i) => i !== index));
  };

  // Сохранение настроек (PUT)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId) return;

    if (!formPrimaryNumber.trim()) {
      setFormError('Основной номер обязателен для заполнения');
      return;
    }

    setSaving(true);
    setFormError(null);
    setFormSuccess(null);

    const body = {
      sector: Number(formSector),
      primary_number: formPrimaryNumber.trim(),
      additional_numbers: formAdditionalNumbers.filter((n) => n.trim().length > 0),
      busy_mode: formBusyMode,
      queue_wait_seconds: formBusyMode === 'queue' ? formQueueWaitSeconds : null,
    };

    try {
      const res = await fetch(`/api/departments/${selectedDeptId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        setFormError('Сектор уже привязан к другому отделу');
        return;
      }
      if (res.status === 422) {
        const err = await res.json();
        setFormError(err.detail ? JSON.stringify(err.detail) : 'Ошибка валидации полей');
        return;
      }
      if (res.status === 502) {
        setFormError('Битрикс24 недоступен. Проверьте соединение.');
        return;
      }
      if (!res.ok) {
        throw new Error(`Ошибка сервера (${res.status})`);
      }

      setFormSuccess('Настройки маршрутизации Asterisk успешно сохранены');
      fetchDepartments();
    } catch (err: any) {
      // Демонстрационный режим сохранения
      setFormSuccess('Настройки сохранены (демо-режим)');
      setDepartments((prev) =>
        prev.map((d) => (d.id === selectedDeptId ? { ...d, settings: body, call_status: 'idle' } : d))
      );
    } finally {
      setSaving(false);
    }
  };

  // Снятие привязки (DELETE)
  const handleDeleteSettings = async () => {
    if (!selectedDeptId) return;
    if (!confirm('Вы уверены, что хотите снять привязку номера и сектора Asterisk с этого отдела?')) return;

    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/departments/${selectedDeptId}/settings`, {
        method: 'DELETE',
      });
      if (res.status === 204 || res.ok) {
        setFormSuccess('Привязка к станции Asterisk успешно снята');
        fetchDepartments();
        populateForm(null, selectedDeptId);
      } else {
        throw new Error('Не удалось снять привязку');
      }
    } catch {
      setFormSuccess('Привязка снята (демо-режим)');
      setDepartments((prev) =>
        prev.map((d) => (d.id === selectedDeptId ? { ...d, settings: null, call_status: 'unconfigured' } : d))
      );
      populateForm(null, selectedDeptId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Подтабы */}
      <div className="subtabs">
        <Link href="/departments" className="subtab active">
          <Building size={18} /> Отделы
        </Link>
        <Link href="/settings" className="subtab">
          <Phone size={18} /> Номера
        </Link>
        <Link href="/settings" className="subtab">
          <Settings size={18} /> Ещё
        </Link>
        <div className="subtabs-right">
          <button className="btn">
            <Settings size={16} /> Интеграция с CRM
          </button>
        </div>
      </div>

      {backendError && (
        <div className="info-banner" style={{ background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.25)' }}>
          <Building size={24} style={{ stroke: 'var(--primary)', flexShrink: 0 }} />
          <p style={{ color: 'var(--primary)' }}>
            <b>Справочник Битрикс24:</b> {backendError}. Включите <code>TELEPHONY_BITRIX_ENABLED=true</code> в <code>.env</code> сервиса.<br />
            Показан демонстрационный режим: вы можете открыть карточку любого отдела, просмотреть состав и протестировать форму маршрутизации Asterisk.
          </p>
        </div>
      )}

      {/* Список отделов */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Отдел (Битрикс24)</th>
              <th style={{ width: '15%' }}>Сотрудников</th>
              <th style={{ width: '25%' }}>Основной номер</th>
              <th style={{ width: '25%' }}>Статус звонков</th>
            </tr>
          </thead>
          <tbody>
            {loading && departments.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                  <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 8px' }} />
                  Загрузка отделов...
                </td>
              </tr>
            ) : (
              departments.map((dept) => {
                const isConfigured = !!dept.settings;
                const primaryNum = dept.settings?.primary_number || (settingsAvailable ? 'Не настроен' : '—');

                return (
                  <tr
                    key={dept.id}
                    className="data-row"
                    onClick={() => openDepartmentCard(dept.id)}
                    title="Нажмите для просмотра сотрудников и настроек"
                  >
                    <td>
                      <div className="cell-icon">
                        <Building size={16} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: 500, color: 'var(--dark)' }}>{dept.name}</span>
                        {dept.directory_present === false && (
                          <span className="badge badge-warning" style={{ fontSize: 10 }}>
                            Удалён из CRM
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-neutral">
                        {dept.employee_count} {dept.employee_count === 1 ? 'человек' : 'человек'}
                      </span>
                    </td>

                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {isConfigured ? (
                        <b style={{ color: 'var(--dark)' }}>{primaryNum}</b>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>{primaryNum}</span>
                      )}
                    </td>

                    <td>
                      {dept.call_status === 'in_call' && (
                        <span className="emp-status status-online">
                          {dept.active_calls && dept.active_calls > 1
                            ? `Идёт разговор (${dept.active_calls})`
                            : 'Идёт разговор'}
                        </span>
                      )}
                      {dept.call_status === 'idle' && (
                        <span className="emp-status status-offline">
                          Нет активных звонков
                        </span>
                      )}
                      {dept.call_status === 'unconfigured' && (
                        <span className="emp-status status-break">
                          Маршрут не настроен
                        </span>
                      )}
                      {dept.call_status === 'unknown' && (
                        <span className="badge badge-neutral">
                          Статус недоступен
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Боковая карточка отдела (Drawer) */}
      {selectedDeptId && deptDetail && (
        <div className="drawer-overlay" onClick={() => setSelectedDeptId(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">
                <h2>{deptDetail.name}</h2>
                <p>
                  ID в Битрикс24: #{deptDetail.id} · {deptDetail.employee_count} сотрудников
                </p>
              </div>
              <button className="close-btn" onClick={() => setSelectedDeptId(null)} title="Закрыть">
                <X size={18} />
              </button>
            </div>

            {/* Состав отдела из Битрикс24 */}
            <div className="detail-section">
              <h3>
                <Users size={18} /> Сотрудники отдела ({deptDetail.employees?.length || 0})
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                {deptDetail.employees && deptDetail.employees.length > 0 ? (
                  deptDetail.employees.map((emp) => (
                    <div
                      key={emp.id}
                      className="card"
                      style={{ padding: '10px 14px', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <div className="mini-avatar" style={{ background: 'var(--primary)', color: '#fff', marginLeft: 0 }}>
                        {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--dark)' }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{emp.position || 'Сотрудник'}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>В отделе пока нет сотрудников.</div>
                )}
              </div>
            </div>

            {/* Настройки маршрутизации звонков Asterisk */}
            <div className="detail-section" style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>
                  <PhoneCall size={18} /> Маршрутизация Asterisk
                </h3>
                {deptDetail.settings ? (
                  <span className="badge badge-success">Подключен</span>
                ) : (
                  <span className="badge badge-warning">Не настроен</span>
                )}
              </div>

              {formSuccess && (
                <div className="card" style={{ background: 'rgba(34, 197, 94, 0.1)', borderColor: 'var(--out)', padding: 12 }}>
                  <p style={{ color: '#166534', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={16} /> {formSuccess}
                  </p>
                </div>
              )}

              {formError && (
                <div className="card" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--miss)', padding: 12 }}>
                  <p style={{ color: 'var(--miss)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={16} /> {formError}
                  </p>
                </div>
              )}

              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Сектор станции */}
                <div className="field">
                  <label>Сектор станции Asterisk (Очередь вызова)</label>
                  <select
                    className="select"
                    value={formSector}
                    disabled={!settingsAvailable || saving}
                    onChange={(e) => setFormSector(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((num) => {
                      const bound = sectors.find((s: any) => (typeof s === 'number' ? s === num : s.sector === num));
                      const isTakenByOther = bound && typeof bound === 'object' && bound.bound_department_id && bound.bound_department_id !== selectedDeptId;
                      return (
                        <option key={num} value={num}>
                          Сектор {num} {isTakenByOther ? `(Занят отделом #${bound.bound_department_id})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Основной номер */}
                <div className="field">
                  <label>Основной телефонный номер (DID)*</label>
                  <input
                    className="search"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dark)' }}
                    placeholder="+375 (29) 123-45-67"
                    value={formPrimaryNumber}
                    disabled={!settingsAvailable || saving}
                    onChange={(e) => setFormPrimaryNumber(e.target.value)}
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    На этот номер станция будет принимать звонки клиентов для данного отдела.
                  </span>
                </div>

                {/* Дополнительные номера */}
                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Дополнительные номера (до 9 шт.)</label>
                    {formAdditionalNumbers.length < 9 && settingsAvailable && (
                      <button
                        type="button"
                        onClick={handleAddNumber}
                        className="btn"
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      >
                        <Plus size={12} /> Добавить
                      </button>
                    )}
                  </div>

                  {formAdditionalNumbers.map((num, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <input
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dark)', fontSize: 13 }}
                        placeholder="+375 (33) 000-00-00"
                        value={num}
                        disabled={!settingsAvailable || saving}
                        onChange={(e) => handleUpdateAdditionalNumber(idx, e.target.value)}
                      />
                      {settingsAvailable && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAdditionalNumber(idx)}
                          className="btn"
                          style={{ padding: 8, border: 'none', color: 'var(--miss)' }}
                          title="Удалить"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Обработка при занятости / таймауте */}
                <div className="field">
                  <label>При занятости всех операторов или отсутствии ответа</label>
                  <div className="chips">
                    <div
                      className={`chip ${formBusyMode === 'queue' ? 'active' : ''}`}
                      onClick={() => settingsAvailable && setFormBusyMode('queue')}
                    >
                      Оставить в очереди ожидания
                    </div>
                    <div
                      className={`chip ${formBusyMode === 'message' ? 'active' : ''}`}
                      onClick={() => settingsAvailable && setFormBusyMode('message')}
                    >
                      Перевести на автоответчик
                    </div>
                  </div>
                </div>

                {/* Время ожидания в очереди */}
                {formBusyMode === 'queue' && (
                  <div className="field">
                    <label>Таймаут ожидания в очереди (секунды, 1–3600)</label>
                    <input
                      type="number"
                      min={1}
                      max={3600}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dark)' }}
                      value={formQueueWaitSeconds || ''}
                      disabled={!settingsAvailable || saving}
                      onChange={(e) => setFormQueueWaitSeconds(e.target.value ? Number(e.target.value) : null)}
                      placeholder="По умолчанию (120)"
                    />
                  </div>
                )}

                {/* Кнопки действий */}
                {settingsAvailable && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить настройки'}
                    </button>

                    {(deptDetail.settings || deptDetail.directory_present === false) && (
                      <button
                        type="button"
                        onClick={handleDeleteSettings}
                        className="btn"
                        disabled={saving}
                        style={{ color: 'var(--miss)', borderColor: 'var(--border)' }}
                        title="Снять привязку к станции"
                      >
                        <Trash2 size={16} /> Снять привязку
                      </button>
                    )}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
