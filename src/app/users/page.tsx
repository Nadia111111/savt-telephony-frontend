'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { AuthUser, UserRole, UsersPage } from '@/types/telephony';
import { apiFetch, extractApiError } from '@/lib/api-client';
import {
  Users,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Shield,
  X,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Lock,
} from 'lucide-react';

const ROLE_LABELS: Record<UserRole, string> = {
  viewer: 'Наблюдатель (viewer)',
  manager: 'Менеджер (manager)',
  admin: 'Администратор (admin)',
};

export default function UsersAdminPage() {
  const { user: currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const limit = 50;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('viewer');
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit modal
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('viewer');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editPassword, setEditPassword] = useState<string>('');
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      const res = await apiFetch(`/api/auth/users?${params.toString()}`);

      if (res.status === 403) {
        setError('Нет доступа: раздел доступен только администраторам.');
        return;
      }

      if (!res.ok) {
        const msg = await extractApiError(res, `Ошибка загрузки аккаунтов (${res.status})`);
        setError(msg);
        return;
      }

      const data: UsersPage | AuthUser[] = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
        setTotal(data.length);
      } else {
        setUsers(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      setError('Не удалось загрузить список пользователей');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, offset]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (!isAdmin) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <Lock size={32} style={{ color: 'var(--miss)', margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)', marginBottom: 6 }}>
          Доступ запрещён
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Управление аккаунтами доступно только пользователям с ролью <b>admin</b>.
        </p>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newUsername.trim()) {
      setCreateError('Укажите логин пользователя');
      return;
    }
    if (newPassword.length < 15 || newPassword.length > 128) {
      setCreateError('Пароль должен содержать от 15 до 128 символов');
      return;
    }

    setCreateSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
        }),
      });

      if (!res.ok) {
        const msg = await extractApiError(res, `Ошибка создания аккаунта (${res.status})`);
        setCreateError(msg);
        return;
      }

      setShowCreate(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('viewer');
      setSuccessMsg('Аккаунт успешно создан');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchUsers();
    } catch {
      setCreateError('Не удалось связаться с сервером');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEditModal = (u: AuthUser) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditIsActive(u.is_active !== false);
    setEditPassword('');
    setEditError(null);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);

    if (editPassword && (editPassword.length < 15 || editPassword.length > 128)) {
      setEditError('Новый пароль должен содержать от 15 до 128 символов');
      return;
    }

    const payload: Record<string, any> = {
      role: editRole,
      is_active: editIsActive,
    };
    if (editPassword) {
      payload.password = editPassword;
    }

    setEditSubmitting(true);
    try {
      const res = await apiFetch(`/api/auth/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await extractApiError(res, `Ошибка обновления аккаунта (${res.status})`);
        setEditError(msg);
        return;
      }

      setEditingUser(null);
      setSuccessMsg('Данные пользователя обновлены (активные сессии пользователя отозваны при изменении прав/пароля)');
      setTimeout(() => setSuccessMsg(null), 5000);
      fetchUsers();
    } catch {
      setEditError('Не удалось связаться с сервером');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: 'var(--primary)' }} />
            Пользователи и роли доступа
          </h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Смена роли, пароля или отключение аккаунта автоматически завершает все его активные сессии.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={fetchUsers} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Обновить
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setCreateError(null);
              setShowCreate(true);
            }}
          >
            <Plus size={15} /> Новый аккаунт
          </button>
        </div>
      </div>

      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(34,197,94,0.1)',
            color: 'var(--out)',
            border: '1px solid rgba(34,197,94,0.3)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
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
              <th style={{ width: '10%' }}>ID</th>
              <th style={{ width: '30%' }}>Логин</th>
              <th style={{ width: '25%' }}>Роль</th>
              <th style={{ width: '20%' }}>Статус</th>
              <th style={{ width: '15%', textAlign: 'right' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                  <RefreshCw className="animate-spin" size={20} style={{ margin: '0 auto 8px' }} />
                  Загрузка аккаунтов...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                  Аккаунты не найдены
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const active = u.is_active !== false;
                const isSelf = currentUser?.id === u.id;
                return (
                  <tr key={u.id} className="data-row" onClick={() => openEditModal(u)}>
                    <td style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>#{u.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b style={{ color: 'var(--dark)' }}>{u.username}</b>
                        {isSelf && (
                          <span className="badge badge-neutral" style={{ fontSize: 10 }}>Вы</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          u.role === 'admin'
                            ? 'badge-warning'
                            : u.role === 'manager'
                            ? 'badge-neutral'
                            : 'badge-neutral'
                        }`}
                      >
                        <Shield size={12} style={{ marginRight: 4 }} />
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td>
                      {active ? (
                        <span className="badge badge-success">Активен</span>
                      ) : (
                        <span className="badge badge-danger">Отключён</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => openEditModal(u)}
                      >
                        <Edit3 size={13} /> Изменить
                      </button>
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

      {/* Модалка создания аккаунта */}
      {showCreate && (
        <div className="drawer-overlay" style={{ alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCreate(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420, margin: 16, padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)' }}>Новый аккаунт</h2>
              <button className="close-btn" onClick={() => setShowCreate(false)}>
                <X size={16} />
              </button>
            </div>

            {createError && (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--miss)', fontSize: 12, marginBottom: 14 }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                  Логин*
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dark)', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                  Пароль (15–128 символов)*
                </label>
                <input
                  type="password"
                  required
                  minLength={15}
                  maxLength={128}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dark)', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                  Роль*
                </label>
                <select
                  className="select"
                  style={{ width: '100%' }}
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                >
                  <option value="viewer">{ROLE_LABELS.viewer}</option>
                  <option value="manager">{ROLE_LABELS.manager}</option>
                  <option value="admin">{ROLE_LABELS.admin}</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn" onClick={() => setShowCreate(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary" disabled={createSubmitting}>
                  {createSubmitting ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка редактирования аккаунта */}
      {editingUser && (
        <div className="drawer-overlay" style={{ alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditingUser(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 420, margin: 16, padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)' }}>
                Аккаунт: {editingUser.username}
              </h2>
              <button className="close-btn" onClick={() => setEditingUser(null)}>
                <X size={16} />
              </button>
            </div>

            {editError && (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--miss)', fontSize: 12, marginBottom: 14 }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                  Роль
                </label>
                <select
                  className="select"
                  style={{ width: '100%' }}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                >
                  <option value="viewer">{ROLE_LABELS.viewer}</option>
                  <option value="manager">{ROLE_LABELS.manager}</option>
                  <option value="admin">{ROLE_LABELS.admin}</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--dark)' }}>
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                  />
                  Аккаунт активен (разрешён вход)
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
                  Новый пароль (оставьте пустым, если не меняете; 15–128 символов)
                </label>
                <input
                  type="password"
                  minLength={15}
                  maxLength={128}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Новый пароль (опционально)"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dark)', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn" onClick={() => setEditingUser(null)}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
