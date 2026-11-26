'use client';

import { AuthUser } from '@/types/telephony';

type AuthCallbacks = {
  onUserUpdated?: (user: AuthUser) => void;
  onSessionExpired?: () => void;
};

let authCallbacks: AuthCallbacks = {};
let inFlightRefresh: Promise<boolean> | null = null;

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const REFRESH_LOCK_NAME = 'savt_auth_refresh_lock';
const STORAGE_LOCK_KEY = 'savt_auth_refresh_lock_ts';

export function registerAuthCallbacks(callbacks: AuthCallbacks) {
  authCallbacks = callbacks;
}

export async function extractApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string' && data.detail.trim()) {
      return data.detail;
    }
    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      return data.detail
        .map((item: any) => item?.msg || JSON.stringify(item))
        .join('; ');
    }
  } catch {
    // non-JSON response
  }
  return fallback;
}

export function parseRetryAfterSeconds(headerValue: string | null): number {
  if (!headerValue) return 60;
  const trimmed = headerValue.trim();
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.max(1, Math.ceil(numeric));
  }
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const diffSec = Math.ceil((parsedDate - Date.now()) / 1000);
    return Math.max(1, diffSec);
  }
  return 60;
}

async function fetchMeRaw(): Promise<{ ok: boolean; status: number; user: AuthUser | null }> {
  const res = await fetch('/api/auth/me', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false, status: res.status, user: null };
  }
  const data = await res.json();
  const user: AuthUser = data?.user ?? data;
  return { ok: true, status: res.status, user };
}

async function performLockedRefresh(): Promise<boolean> {
  // 1. After acquiring lock, check /api/auth/me first: another tab might already have refreshed.
  try {
    const meCheck = await fetchMeRaw();
    if (meCheck.ok && meCheck.user) {
      authCallbacks.onUserUpdated?.(meCheck.user);
      return true;
    }
  } catch {
    return false;
  }

  // 2. Otherwise execute /api/auth/refresh once.
  try {
    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'X-SAVT-CSRF': '1',
      },
    });
    if (!refreshRes.ok) {
      return false;
    }
    const meAfter = await fetchMeRaw();
    if (meAfter.ok && meAfter.user) {
      authCallbacks.onUserUpdated?.(meAfter.user);
    }
    return true;
  } catch {
    return false;
  }
}

async function acquireCrossTabLockAndRefresh(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK_NAME, async () => {
      return performLockedRefresh();
    });
  }

  // Fallback cross-tab spin mutex via localStorage if Web Locks API is unavailable.
  if (typeof window !== 'undefined' && window.localStorage) {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const existing = Number(window.localStorage.getItem(STORAGE_LOCK_KEY) || '0');
      if (!existing || Date.now() - existing > 10000) {
        window.localStorage.setItem(STORAGE_LOCK_KEY, String(Date.now()));
        try {
          return await performLockedRefresh();
        } finally {
          window.localStorage.removeItem(STORAGE_LOCK_KEY);
        }
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return performLockedRefresh();
}

export async function refreshSessionWithLock(): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = acquireCrossTabLockAndRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

function buildRequestInit(init?: RequestInit): RequestInit {
  const method = (init?.method || 'GET').toUpperCase();
  const headers = new Headers(init?.headers || {});

  if (MUTATING_METHODS.has(method) && !headers.has('X-SAVT-CSRF')) {
    headers.set('X-SAVT-CSRF', '1');
  }

  if (
    init?.body !== undefined &&
    init.body !== null &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  return {
    ...init,
    method,
    credentials: 'same-origin',
    headers,
  };
}

/**
 * Unified API fetch wrapper:
 * - Relative URLs + credentials: 'same-origin'
 * - Automatic X-SAVT-CSRF: 1 for mutating requests & JSON Content-Type
 * - Single-flight cross-tab refresh + 1 retry on 401
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const requestInit = buildRequestInit(init);
  const res = await fetch(input, requestInit);

  const isAuthEndpoint =
    input.startsWith('/api/auth/login') ||
    input.startsWith('/api/auth/refresh') ||
    input.startsWith('/api/auth/logout');

  if (res.status === 401 && !isAuthEndpoint && !init?.signal?.aborted) {
    const refreshed = await refreshSessionWithLock();
    if (refreshed) {
      return fetch(input, buildRequestInit(init));
    }
    authCallbacks.onSessionExpired?.();
  }

  return res;
}
