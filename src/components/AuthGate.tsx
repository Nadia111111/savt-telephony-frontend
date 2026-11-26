'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch, extractApiError } from '@/lib/api-client';
import { Lock, User, AlertCircle, CheckCircle2, RefreshCw, X, KeyRound } from 'lucide-react';

const BG_LOGOS = [
  { top: '4%', left: '5%', size: 112, blur: 2.5, opacity: 0.22, rot: '-18deg', dur: '15s' },
  { top: '8%', left: '24%', size: 80, blur: 3.5, opacity: 0.18, rot: '14deg', dur: '18s' },
  { top: '6%', left: '48%', size: 96, blur: 4.5, opacity: 0.16, rot: '-8deg', dur: '16s' },
  { top: '5%', left: '72%', size: 124, blur: 3, opacity: 0.2, rot: '22deg', dur: '19s' },
  { top: '12%', left: '88%', size: 88, blur: 3.5, opacity: 0.18, rot: '-24deg', dur: '14s' },
  { top: '26%', left: '12%', size: 138, blur: 3, opacity: 0.2, rot: '12deg', dur: '20s' },
  { top: '28%', left: '34%', size: 76, blur: 5, opacity: 0.16, rot: '-15deg', dur: '17s' },
  { top: '25%', left: '64%', size: 90, blur: 4, opacity: 0.17, rot: '19deg', dur: '15s' },
  { top: '31%', left: '84%', size: 132, blur: 3, opacity: 0.22, rot: '-11deg', dur: '21s' },
  { top: '48%', left: '3%', size: 94, blur: 3.5, opacity: 0.19, rot: '25deg', dur: '16s' },
  { top: '52%', left: '22%', size: 118, blur: 2.5, opacity: 0.21, rot: '-20deg', dur: '18s' },
  { top: '50%', left: '76%', size: 110, blur: 3, opacity: 0.2, rot: '16deg', dur: '17s' },
  { top: '56%', left: '92%', size: 84, blur: 4, opacity: 0.17, rot: '-14deg', dur: '15s' },
  { top: '70%', left: '10%', size: 128, blur: 2.5, opacity: 0.22, rot: '-9deg', dur: '19s' },
  { top: '74%', left: '32%', size: 88, blur: 4.5, opacity: 0.16, rot: '21deg', dur: '16s' },
  { top: '76%', left: '54%', size: 104, blur: 4, opacity: 0.17, rot: '-17deg', dur: '22s' },
  { top: '72%', left: '72%', size: 136, blur: 2.5, opacity: 0.23, rot: '11deg', dur: '18s' },
  { top: '84%', left: '88%', size: 98, blur: 3.5, opacity: 0.19, rot: '-22deg', dur: '14s' },
  { top: '86%', left: '20%', size: 80, blur: 3.5, opacity: 0.18, rot: '15deg', dur: '17s' },
  { top: '88%', left: '44%', size: 92, blur: 4.5, opacity: 0.16, rot: '-6deg', dur: '20s' },
];

function LoginScreen() {
  const { login, authNotice, serverError, refreshProfile, clearAuthNotice } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);

  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = setInterval(() => {
      setRetryCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [retryCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retryCountdown > 0 || !username.trim() || !password) return;

    setSubmitting(true);
    setError(null);
    clearAuthNotice();

    const result = await login(username.trim(), password);
    if (!result.ok) {
      setError(result.error || 'Ошибка входа');
      if (result.retryAfterSeconds && result.retryAfterSeconds > 0) {
        setRetryCountdown(result.retryAfterSeconds);
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-bg-layer" aria-hidden="true">
        {BG_LOGOS.map((item, idx) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={idx}
            src="/logo.png"
            alt=""
            className="auth-bg-logo"
            style={
              {
                top: item.top,
                left: item.left,
                width: item.size,
                height: 'auto',
                opacity: item.opacity,
                filter: `blur(${item.blur}px)`,
                '--rot': item.rot,
                '--dur': item.dur,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="card auth-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="SAVT"
            style={{
              width: 165,
              height: 'auto',
              display: 'block',
              marginBottom: 8,
              filter: 'drop-shadow(0 6px 14px rgba(37, 99, 235, 0.18))',
            }}
          />
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--dark)', lineHeight: 1.15 }}>Телефония SAVT</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            Войдите в панель управления АТС
          </p>
        </div>

        {authNotice && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: 'var(--out)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{authNotice}</span>
          </div>
        )}

        {serverError && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: 'var(--wait)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <span>{serverError}</span>
            <button
              type="button"
              className="btn"
              style={{ padding: '4px 8px', fontSize: 11 }}
              onClick={refreshProfile}
            >
              Повторить
            </button>
          </div>
        )}

        {(error || retryCountdown > 0) && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--miss)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>
              {retryCountdown > 0
                ? `Слишком много попыток входа. Повторите через ${retryCountdown} сек.`
                : error}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 4 }}>
              Логин
            </label>
            <div style={{ position: 'relative' }}>
              <User size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Введите логин"
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  color: 'var(--dark)',
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 4 }}>
              Пароль
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  color: 'var(--dark)',
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || retryCountdown > 0}
            style={{ width: '100%', justifyContent: 'center', padding: '9px', marginTop: 4 }}
          >
            {submitting ? (
              <>
                <RefreshCw size={15} className="animate-spin" /> Вход...
              </>
            ) : retryCountdown > 0 ? (
              `Подождите (${retryCountdown} с)`
            ) : (
              'Войти'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function ChangePasswordModal() {
  const { isChangePasswordOpen, closeChangePassword, onPasswordChanged } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isChangePasswordOpen) return null;

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    closeChangePassword();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 15 || newPassword.length > 128) {
      setError('Новый пароль должен содержать от 15 до 128 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Подтверждение не совпадает с новым паролем');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!res.ok) {
        const detail = await extractApiError(res, `Ошибка смены пароля (${res.status})`);
        setError(detail);
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onPasswordChanged();
    } catch {
      setError('Не удалось связаться с сервером');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="drawer-overlay" style={{ alignItems: 'center', justifyContent: 'center' }} onClick={handleClose}>
      <div
        className="card"
        style={{ width: '100%', maxWidth: 420, margin: 16, padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={18} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)' }}>Смена пароля</h2>
          </div>
          <button className="close-btn" onClick={handleClose} title="Закрыть">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--miss)',
              fontSize: 12,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
              Текущий пароль
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--dark)',
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
              Новый пароль (15–128 символов)
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={15}
              maxLength={128}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--dark)',
                fontSize: 13,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>
              Повторите новый пароль
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={15}
              maxLength={128}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--dark)',
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn" onClick={handleClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Сохранение...' : 'Сохранить пароль'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--muted)',
          gap: 12,
        }}
      >
        <RefreshCw size={26} className="animate-spin" style={{ color: 'var(--primary)' }} />
        <span style={{ fontSize: 13 }}>Проверка сессии...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <>
      {children}
      <ChangePasswordModal />
    </>
  );
}
