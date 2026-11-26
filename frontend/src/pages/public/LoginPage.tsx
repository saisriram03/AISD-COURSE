import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Lock, ShieldAlert, Sparkles, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_ACCOUNTS, IS_DEMO_MODE_ENABLED } from '@/features/auth/demoAccounts';
import { ROLE_HOME_ROUTES, type UserRole } from '@/types/auth';
import { fadeInUp } from '@/lib/motion';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  full_name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['DEPT_ADMIN', 'FACULTY', 'STUDENT']),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (!err.response) {
      return 'Cannot reach the FastAPI backend at http://localhost:8000/api/v1. Please ensure the backend server is running.';
    }
  }
  return fallback;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const registerUser = useAuthStore((s) => s.register);
  const enterDemoMode = useAuthStore((s) => s.enterDemoMode);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [demoLoadingRole, setDemoLoadingRole] = useState<UserRole | null>(null);

  const redirectTarget = (location.state as { from?: string } | null)?.from;

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: '', email: '', password: '', role: 'DEPT_ADMIN' },
  });

  const onLoginSubmit = async (values: LoginFormValues) => {
    setAuthError(null);
    try {
      const user = await login(values);
      navigate(redirectTarget ?? ROLE_HOME_ROUTES[user.role], { replace: true });
    } catch (err) {
      setAuthError(extractErrorMessage(err, 'Invalid email or password.'));
    }
  };

  const onRegisterSubmit = async (values: RegisterFormValues) => {
    setAuthError(null);
    try {
      const user = await registerUser(values);
      navigate(ROLE_HOME_ROUTES[user.role], { replace: true });
    } catch (err) {
      setAuthError(extractErrorMessage(err, 'Could not create account.'));
    }
  };

  const handleDemoEnter = async (role: UserRole) => {
    setAuthError(null);
    setDemoLoadingRole(role);
    try {
      const user = await enterDemoMode(role);
      navigate(ROLE_HOME_ROUTES[user.role], { replace: true });
    } catch (err) {
      setAuthError(extractErrorMessage(err, 'Could not start demo session.'));
    } finally {
      setDemoLoadingRole(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="grid w-full gap-8 lg:grid-cols-12"
      >
        {/* Credential Login / Create Account */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-violet-soft)] text-[var(--accent-violet)]">
                  {mode === 'login' ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </div>
                <Badge variant="violet">JWT Authentication</Badge>
              </div>

              <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setAuthError(null);
                  }}
                  className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                    mode === 'login'
                      ? 'bg-[var(--accent-violet)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setAuthError(null);
                  }}
                  className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                    mode === 'register'
                      ? 'bg-[var(--accent-violet)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Create Account
                </button>
              </div>
            </div>

            <CardTitle className="text-2xl">
              {mode === 'login' ? 'Sign in to SMARTSCHED' : 'Create your SMARTSCHED account'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Sign in with your account, or switch to Create Account to register a new email.'
                : 'Register your own Admin, Faculty, or Student account to manage or view timetables.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {mode === 'login' ? (
              <form
                onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                className="space-y-4"
                noValidate
              >
                <Input
                  label="University Email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@university.edu.in"
                  error={loginForm.formState.errors.email?.message}
                  {...loginForm.register('email')}
                />

                <Input
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  error={loginForm.formState.errors.password?.message}
                  {...loginForm.register('password')}
                />

                {authError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] p-3 text-xs text-[var(--accent-coral)]"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <Link
                    to="/forgot-password"
                    className="text-[var(--accent-cyan)] hover:underline"
                  >
                    Forgot password?
                  </Link>
                  <span className="font-mono text-[var(--text-muted)]">Argon2 + JWT</span>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && !demoLoadingRole ? 'Signing in...' : 'Sign In'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <form
                onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
                className="space-y-4"
                noValidate
              >
                <Input
                  label="Full Name"
                  type="text"
                  placeholder="Sai Sriram"
                  error={registerForm.formState.errors.full_name?.message}
                  {...registerForm.register('full_name')}
                />

                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  error={registerForm.formState.errors.email?.message}
                  {...registerForm.register('email')}
                />

                <Input
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  error={registerForm.formState.errors.password?.message}
                  {...registerForm.register('password')}
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium tracking-wide text-[var(--text-secondary)] uppercase">
                    Role
                  </label>
                  <select
                    {...registerForm.register('role')}
                    className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
                  >
                    <option value="DEPT_ADMIN">Department Admin (Create & Edit Timetables)</option>
                    <option value="FACULTY">Faculty (View Assigned Teaching Timetable)</option>
                    <option value="STUDENT">Student (View Batch Timetable)</option>
                  </select>
                </div>

                {authError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-[var(--accent-coral)]/30 bg-[var(--accent-coral-soft)] p-3 text-xs text-[var(--accent-coral)]"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && !demoLoadingRole ? 'Creating account...' : 'Create Account & Enter'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Development-Only Demo Mode */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <div className="mb-2 flex items-center justify-between">
              <Badge variant="amber">
                <Sparkles className="h-3 w-3" />
                Development Demo Mode
              </Badge>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                1-CLICK ACCESS · REAL JWT
              </span>
            </div>
            <CardTitle>Role Portal Explorer</CardTitle>
            <CardDescription>
              Click any role below for instant 1-click sign-in with seeded sample data (no password
              needed). Disabled in production builds.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {IS_DEMO_MODE_ENABLED ? (
              <div className="space-y-2.5">
                {DEMO_ACCOUNTS.map((account) => {
                  const loadingThis = demoLoadingRole === account.role;
                  return (
                    <button
                      key={account.role}
                      type="button"
                      data-cursor="button"
                      disabled={isLoading}
                      onClick={() => void handleDemoEnter(account.role)}
                      className="flex w-full items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 text-left transition-all hover:border-[var(--accent-violet)]/50 hover:bg-[var(--bg-glass-hover)] disabled:opacity-60"
                    >
                      <div className="pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {account.label}
                          </span>
                          <span className="font-mono text-[11px] text-[var(--accent-cyan)]">
                            {account.user.fullName}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {account.description}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">
                        {loadingThis ? '...' : <ArrowRight className="h-4 w-4" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)]">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-amber)]" />
                <p>
                  Demo role switching is disabled in production mode. Sign in with your verified
                  university credentials.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
