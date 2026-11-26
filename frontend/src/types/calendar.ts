export type CalendarDay = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type PeriodType = 'TEACHING' | 'BREAK' | 'LUNCH' | 'NON_TEACHING';

export interface OperatingDay {
  id?: string;
  day_of_week: CalendarDay;
  is_open: boolean;
  opening_time: string;
  closing_time: string;
}

export interface SchedulePeriod {
  id?: string;
  day_of_week: CalendarDay;
  name: string;
  start_time: string;
  end_time: string;
  period_type: PeriodType;
  enabled: boolean;
  sort_order: number;
}

export interface DepartmentSchedule {
  department_id: string;
  operating_days: OperatingDay[];
  periods: SchedulePeriod[];
}

export type DepartmentSchedulePayload = Omit<DepartmentSchedule, 'department_id'>;
