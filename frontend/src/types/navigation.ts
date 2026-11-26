import type { LucideIcon } from 'lucide-react';
import type { UserRole } from './auth';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  group: string;
  roles: UserRole[];
  phase?: number;
}

export interface CommandItem {
  id: string;
  label: string;
  description: string;
  category: 'Navigation' | 'Action' | 'Theme';
  shortcut?: string;
  action: () => void;
}
