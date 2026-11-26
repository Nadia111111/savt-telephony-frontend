export type CallOutcome =
  | 'answered'
  | 'abandoned_menu'
  | 'abandoned_queue'
  | 'message_afterhours'
  | 'message_queue_full'
  | 'message_no_answer'
  | 'blocked'
  | 'outgoing_no_answer'
  | 'outgoing_busy'
  | 'outgoing_cancelled'
  | 'outgoing_failed';

export type CallListItem = {
  id: number;
  started_at: string;
  ended_at: string | null;
  caller: string | null;
  caller_raw: string | null;
  sector: number | null;
  sector_name?: string | null;
  sector_by_default?: boolean;
  outcome: CallOutcome | null;
  answered_by: string | null;
  employee_name?: string | null;
  employee_number?: string | null;
  initiated_by?: string | null;
  wait_seconds: number | null;
  talk_seconds: number | null;
  has_recording: boolean;
  has_message: boolean;
  voicemail_left?: boolean;
};

export type CallPage = {
  items: CallListItem[];
  total: number;
};

export type CallSummary = {
  topic: string;
  agreements: string[];
  next_steps: string[];
  deal_code: string | null;
};

export type BitrixDelivery = {
  destination: 'deal' | 'contact' | 'company' | 'chat';
  target_id: number;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'uncertain';
  external_id: number | null;
  last_error: string | null;
};

export type CallDetail = CallListItem & {
  transcription_status:
    | 'pending'
    | 'submitting'
    | 'processing'
    | 'completed'
    | 'failed'
    | null;
  transcript: string | null;
  summary_status: 'pending' | 'completed' | 'skipped' | 'failed' | null;
  summary: CallSummary | null;
  bitrix_routing_status: 'pending' | 'resolved' | 'skipped' | 'failed' | null;
  bitrix_deliveries: BitrixDelivery[];
};

export type CallCounts = {
  incoming: number;
  outgoing: number;
  missed: number;
  missed_with_voicemail?: number;
  missed_without_voicemail?: number;
};

export type CallEvent = {
  id: number;
  received_at: string;
  event: string;
  linkedid: string | null;
  uniqueid: string | null;
  channel: string | null;
  payload: Record<string, string>;
};

export type HealthStatus = {
  status: 'ok' | 'degraded';
  db: 'ok' | 'down';
  ami: 'connected' | 'disconnected' | 'disabled';
};

export type ActiveTab = 'incoming' | 'outgoing' | 'missed';

/* ============ СТАТИСТИКА (API Контракт) ============ */
export type StatisticsTotals = {
  incoming: number;
  outgoing: number;
  missed: number;
  missed_with_voicemail: number;
  missed_without_voicemail: number;
  total: number;
};

export type StatisticsBucket = {
  bucket_start: string;
  incoming: number;
  outgoing: number;
  missed: number;
  missed_with_voicemail: number;
  missed_without_voicemail: number;
  total: number;
};

export type StatisticsCallsResponse = {
  group_by: 'day' | 'week' | 'month';
  timezone: string;
  totals: StatisticsTotals;
  buckets: StatisticsBucket[];
};

export type CallerStatsItem = {
  caller: string;
  calls: number;
  missed: number;
  last_called_at: string;
};

export type CallerStatsResponse = {
  items: CallerStatsItem[];
  total: number;
};

/* ============ ОТДЕЛЫ (API Контракт Битрикс24 + Asterisk) ============ */
export type DepartmentCallStatus = 'in_call' | 'idle' | 'unconfigured' | 'unknown';

export type DepartmentSettings = {
  sector: number;
  primary_number: string;
  additional_numbers: string[];
  busy_mode: 'queue' | 'message';
  queue_wait_seconds: number | null;
};

export type DepartmentEmployee = {
  id: number;
  name: string;
  position: string | null;
  photo_url: string | null;
};

export type DepartmentListItem = {
  id: number;
  name: string;
  parent_id: number | null;
  employee_count: number;
  directory_present?: boolean;
  call_status: DepartmentCallStatus;
  active_calls?: number | null;
  settings: DepartmentSettings | null;
};

export type SectorOption = {
  sector: number;
  name?: string;
  bound_department_id?: number | null;
  bound_department_name?: string | null;
};

export type DepartmentsResponse = {
  items: DepartmentListItem[];
  sectors: Array<SectorOption | number>;
  settings_available: boolean;
};

export type DepartmentDetail = DepartmentListItem & {
  employees: DepartmentEmployee[];
  settings_available: boolean;
};

/* ============ НАСТРОЙКИ АТС И ПРАЗДНИКИ ============ */
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type TelephonySettings = {
  work_days: DayOfWeek[];
  opens_at: string;
  closes_at: string;
  menu_attempts: number;
  menu_timeout_seconds: number;
  default_sector: number;
  queue_wait_seconds: number | null;
  ring_time_seconds: number;
  voicemail_max_seconds: number;
  voicemail_silence_seconds: number;
};

export type HolidaysResponse = {
  dates: string[];
};
