'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, BarChart2, Users, Building, Settings } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'История', href: '/', icon: History },
    { label: 'Статистика', href: '/stats', icon: BarChart2 },
    { label: 'Отделы', href: '/departments', icon: Building },
  ];

  const bottomItems = [
    { label: 'Настройки', href: '/settings', icon: Settings },
  ];

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
