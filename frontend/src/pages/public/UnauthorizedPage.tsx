import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { ROLE_HOME_ROUTES } from '@/types/auth';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export function UnauthorizedPage() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const state = location.state as { fallbackPath?: string } | null;
  const fallback = state?.fallbackPath ?? (user ? ROLE_HOME_ROUTES[user.role] : '/login');

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <Card className="w-full text-center">
        <CardHeader className="items-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-coral-soft)] text-[var(--accent-coral)]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <CardTitle>Access Restricted</CardTitle>
          <CardDescription>
            Your current role does not have permission to view this portal route.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to={fallback}>Return to My Portal</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
