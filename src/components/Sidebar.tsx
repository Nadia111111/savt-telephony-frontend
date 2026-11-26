'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';
import { History, BarChart2, Building, Settings, Users, FileText } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { hasRole } = useAuth();

  const canManage = hasRole('manager', 'admin');
  const isAdmin = hasRole('admin');

  const navItems = [
    { label: 'История', href: '/', icon: History, visible: true },
    { label: 'Статистика', href: '/stats', icon: BarChart2, visible: true },
    { label: 'Отделы', href: '/departments', icon: Building, visible: canManage },
    { label: 'Пользователи', href: '/users', icon: Users, visible: isAdmin },
  ].filter((item) => item.visible);

  const bottomItems = [
    { label: 'Настройки', href: '/settings', icon: Settings, visible: canManage },
  ].filter((item) => item.visible);

  return (
    <aside className="sidebar">
      <Link href="/" className="logo-wrap" title="SAVT Telephony">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="SAVT" className="logo-img" />
      </Link>

      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive ? 'active' : ''}`}
            title={item.label}
          >
            <Icon size={22} />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <div className="spacer" />

      {isAdmin && (
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-item"
          title="Документация API (Swagger)"
        >
          <FileText size={22} />
          <span>API Docs</span>
        </a>
      )}

      {bottomItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive ? 'active' : ''}`}
            title={item.label}
          >
            <Icon size={22} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
