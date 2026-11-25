'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';
import { HealthStatus } from '@/types/telephony';
import { Sun, Moon, LogOut, RefreshCw } from 'lucide-react';

export default function Topbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchHealth = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch('/health');
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
      if (manual) setTimeout(() => setIsRefreshing(false), 500);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Опрос состояния каждые 10 секунд по гайду
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
      case '/settings':
        return 'Настройки';
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
        <div
          className="status-pill"
          onClick={() => fetchHealth(true)}
          title={`Связь с сервером телефонии потеряна: ${healthError || 'Нет ответа'}. Нажмите для повторной проверки.`}
        >
          <span className="status-dot disconnected" />
          <span style={{ color: 'var(--miss)', fontWeight: 600 }}>АТС оффлайн</span>
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} style={{ color: 'var(--muted)', marginLeft: 2 }} />
        </div>
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
      <div
        className="status-pill"
        onClick={() => fetchHealth(true)}
        title={`${tooltip}. Нажмите для обновления.`}
      >
        <span className={`status-dot ${dotClass}`} />
        <span>{label}</span>
        <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} style={{ color: 'var(--muted)', marginLeft: 2 }} />
      </div>
    );
  };

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
          <span>Надежда Фролова</span>
          <div className="avatar" title="Надежда Фролова">НФ</div>
          <button className="theme-toggle" title="Выйти" style={{ width: 32, height: 32 }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
