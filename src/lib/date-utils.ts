// Утилиты работы со временем и часовым поясом Europe/Minsk (UTC+3)

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('ru-RU', {
      timeZone: 'Europe/Minsk',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function formatDayHeader(isoString: string): string {
  try {
    const d = new Date(isoString);
    const weekday = d.toLocaleDateString('ru-RU', {
      timeZone: 'Europe/Minsk',
      weekday: 'long',
    });
    const dayMonth = d.toLocaleDateString('ru-RU', {
      timeZone: 'Europe/Minsk',
      day: 'numeric',
      month: 'long',
    });
    const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return `${capitalized}, ${dayMonth}`;
  } catch {
    return isoString;
  }
}

export function formatDateTimeFull(isoString: string): string {
  try {
    const d = new Date(isoString);
    const day = formatDayHeader(isoString);
    const time = formatTime(isoString);
    return `${day} в ${time}`;
  } catch {
    return isoString;
  }
}

export function formatDateShort(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('ru-RU', {
      timeZone: 'Europe/Minsk',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function getMinskWeekRange(): { dateFrom: string; dateTo: string } {
  return getMinskDateRange('week');
}

export function getMinskMonthRange(): { dateFrom: string; dateTo: string } {
  return getMinskDateRange('month');
}

export function getMinskDateRange(
  preset: 'week' | 'prev_week' | 'month' | 'prev_month' | 'all'
): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const minskTimestamp = now.getTime() + (now.getTimezoneOffset() + 180) * 60 * 1000;
  const minskNow = new Date(minskTimestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (preset === 'week') {
    const day = minskNow.getDay();
    const diff = day === 0 ? -6 : 1 - day; // понедельник текущей недели
    const monday = new Date(minskNow);
    monday.setDate(minskNow.getDate() + diff);
    const fromStr = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}T00:00:00+03:00`;

    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    const toStr = `${nextMonday.getFullYear()}-${pad(nextMonday.getMonth() + 1)}-${pad(nextMonday.getDate())}T00:00:00+03:00`;
    return { dateFrom: fromStr, dateTo: toStr };
  }

  if (preset === 'prev_week') {
    const day = minskNow.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const currentMonday = new Date(minskNow);
    currentMonday.setDate(minskNow.getDate() + diff);

    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(currentMonday.getDate() - 7);

    const fromStr = `${prevMonday.getFullYear()}-${pad(prevMonday.getMonth() + 1)}-${pad(prevMonday.getDate())}T00:00:00+03:00`;
    const toStr = `${currentMonday.getFullYear()}-${pad(currentMonday.getMonth() + 1)}-${pad(currentMonday.getDate())}T00:00:00+03:00`;
    return { dateFrom: fromStr, dateTo: toStr };
  }

  if (preset === 'month') {
    const year = minskNow.getFullYear();
    const month = minskNow.getMonth();
    const fromStr = `${year}-${pad(month + 1)}-01T00:00:00+03:00`;

    const nextMonth = new Date(year, month + 1, 1);
    const toStr = `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-01T00:00:00+03:00`;
    return { dateFrom: fromStr, dateTo: toStr };
  }

  if (preset === 'prev_month') {
    const year = minskNow.getFullYear();
    const prevMonth = minskNow.getMonth() - 1;
    const prevDate = new Date(year, prevMonth, 1);
    const fromStr = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-01T00:00:00+03:00`;

    const toDate = new Date(year, minskNow.getMonth(), 1);
    const toStr = `${toDate.getFullYear()}-${pad(toDate.getMonth() + 1)}-01T00:00:00+03:00`;
    return { dateFrom: fromStr, dateTo: toStr };
  }

  // 'all'
  return {
    dateFrom: '2026-01-01T00:00:00+03:00',
    dateTo: '2027-01-01T00:00:00+03:00',
  };
}
