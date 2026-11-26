import { useAuthStore } from '@/store/useAuthStore';
import { ROLE_LABELS } from '@/types/auth';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const isDemoSession = useAuthStore((s) => s.isDemoSession);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Profile & Account</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Authenticated session details and tenant isolation metadata.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{user.fullName}</CardTitle>
            <Badge variant={isDemoSession ? 'amber' : 'mint'}>
              {isDemoSession ? 'Demo Session' : 'Verified Session'}
            </Badge>
          </div>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <dt className="text-xs text-[var(--text-muted)]">Role</dt>
              <dd className="mt-1 font-medium">{ROLE_LABELS[user.role]}</dd>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <dt className="text-xs text-[var(--text-muted)]">University</dt>
              <dd className="mt-1 font-medium">{user.universityName}</dd>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <dt className="text-xs text-[var(--text-muted)]">Department</dt>
              <dd className="mt-1 font-medium">{user.departmentName ?? 'All Departments'}</dd>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
              <dt className="text-xs text-[var(--text-muted)]">Status</dt>
              <dd className="mt-1 font-medium text-[var(--accent-mint)]">
                {user.isActive ? 'Active' : 'Inactive'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
