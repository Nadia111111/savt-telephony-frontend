'use client';

import { useState, useEffect } from 'react';
import { DepartmentsResponse } from '@/types/telephony';
import { apiFetch } from '@/lib/api-client';

export type DepartmentFilterOption = {
  label: string;
  value: string;
};

const ALL_DEPARTMENTS_OPTION: DepartmentFilterOption = {
  label: 'Все отделы',
  value: '',
};

/**
 * Loads configured Bitrix24 departments from GET /api/departments for select filters.
 */
export function useDepartmentFilterOptions() {
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentFilterOption[]>([
    ALL_DEPARTMENTS_OPTION,
  ]);
  const [departmentsUnavailable, setDepartmentsUnavailable] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    async function loadDepartments() {
      try {
        const res = await apiFetch('/api/departments');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const departments: DepartmentsResponse = await res.json();
        if (!active) return;

        const options: DepartmentFilterOption[] = [
          ALL_DEPARTMENTS_OPTION,
          ...(departments.items || []).flatMap((item) => {
            if (!item.directory_present || !item.settings) return [];
            return [{ label: item.name, value: String(item.settings.sector) }];
          }),
        ];

        setDepartmentOptions(options);
        setDepartmentsUnavailable(departments.settings_available === false && options.length === 1);
      } catch {
        if (!active) return;
        setDepartmentOptions([ALL_DEPARTMENTS_OPTION]);
        setDepartmentsUnavailable(true);
      }
    }

    loadDepartments();
    return () => {
      active = false;
    };
  }, []);

  return { departmentOptions, departmentsUnavailable };
}

/**
 * Formats employee label for table/drawer without technical SIP fallback values.
 */
export function getEmployeeLabel(call: {
  employee_name?: string | null;
  employee_number?: string | null;
}): string {
  return call.employee_name ?? call.employee_number ?? '—';
}
