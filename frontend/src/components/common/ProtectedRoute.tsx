import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { ROLE_HOME_ROUTES, type UserRole } from '@/types/auth';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children: ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to="/unauthorized"
        state={{ expectedRoles: allowedRoles, fallbackPath: ROLE_HOME_ROUTES[user.role] }}
        replace
      />
    );
  }

  return <>{children}</>;
}
