'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from './AuthContext';
import { HealthStatus, UserRole } from '@/types/telephony';
import { Sun, Moon, LogOut, RefreshCw, KeyRound } from 'lucide-react';

const ROLE_LABELS: Record<UserRole, string> = {
  viewer: 'Наблюдатель',
  manager: 'Менеджер',
  admin: 'Администратор',
};

export default function Topbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, openChangePassword } = useAuth();

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchHealth = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch('/health', { credentials: 'same-origin', cache: 'no-store' });
      if (res.status === 200 || res.status === 503) {
        const data = await res.json();
        setHealth(data);
        setHealthError(null);
      } else {
        setHealthError(`Ошибка (${res.status})`);
      }
    } catch {
      setHealthError('Сервер недоступен');
    } finally {
      setHealthLoading(false);
      if (manual) setTimeout(() => setIsRefreshing(false), 600);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => {
      fetchHealth();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const getPageTitle = () => {
    switch (pathname) {
      case '/':
        return 'История';
      case '/stats':
        return 'Статистика';
      case '/departments':
        return 'Отделы';
      case '/contacts':
        return 'Контакты';
      case '/settings':
        return 'Настройки';
      case '/users':
        return 'Пользователи';
      default:
        return 'Телефония';
    }
  };

  const renderHealthIndicator = () => {
    if (healthLoading && !health) {
      return (
        <div className="status-pill" title="Проверка связи с АТС">
          <span className="status-dot disabled" />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Проверка АТС...</span>
        </div>
      );
    }

    if (healthError || !health) {
      return (
        <button
          type="button"
          className="status-pill"
          disabled={isRefreshing}
          onClick={() => fetchHealth(true)}
          title={`Связь с сервером телефонии потеряна: ${healthError || 'Нет ответа'}. Нажмите для повторной проверки.`}
        >
          <span className="status-dot disconnected" />
          <span style={{ color: 'var(--miss)', fontWeight: 600 }}>АТС оффлайн</span>
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} style={{ color: 'var(--muted)', marginLeft: 2 }} />
        </button>
      );
    }

    let dotClass = 'connected';
    let label = 'АТС онлайн';
    const tooltip = `Asterisk AMI: ${health.ami} · База данных: ${health.db}`;

    if (health.ami === 'connected' && health.status === 'ok') {
      dotClass = 'connected';
      label = 'АТС онлайн';
    } else if (health.ami === 'disabled') {
      dotClass = 'disabled';
      label = 'Демо-режим';
    } else if (health.ami === 'disconnected' || health.db === 'down' || health.status === 'degraded') {
      dotClass = 'degraded';
      label = health.ami === 'disconnected' ? 'Asterisk отключен' : 'Деградация АТС';
    }

    return (
      <button
        type="button"
        className="status-pill"
        disabled={isRefreshing}
        onClick={() => fetchHealth(true)}
        title={`${tooltip}. Нажмите для обновления.`}
      >
        <span className={`status-dot ${dotClass}`} />
        <span>{label}</span>
        <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} style={{ color: 'var(--muted)', marginLeft: 2 }} />
      </button>
    );
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="topbar">
      <div className="crumbs">
        <span className="company">Компания</span>
        <span className="sep">/</span>
        <span>Виртуальная АТС</span>
        <span className="sep">/</span>
        <span className="current">{getPageTitle()}</span>
      </div>

      <div className="topbar-right">
        {renderHealthIndicator()}

        <button
          onClick={toggleTheme}
          className="theme-toggle"
          title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="user-profile">
          <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
            <div style={{ fontWeight: 600, color: 'var(--dark)' }}>{user?.username || '—'}</div>
            {user?.role && (
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ROLE_LABELS[user.role] || user.role}</div>
            )}
          </div>
          <div className="avatar" title={user ? `${user.username} (${ROLE_LABELS[user.role]})` : ''}>
            {initials}
          </div>
          <button
            className="theme-toggle"
            title="Сменить пароль"
            onClick={openChangePassword}
            style={{ width: 32, height: 32 }}
          >
            <KeyRound size={15} />
          </button>
          <button
            className="theme-toggle"
            title="Выйти"
            onClick={logout}
            style={{ width: 32, height: 32 }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
