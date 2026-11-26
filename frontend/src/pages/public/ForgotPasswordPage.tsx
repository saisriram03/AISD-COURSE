import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setErrorMsg(null);
    try {
      await apiClient.post('/auth/password-recovery', values);
      setSubmitted(true);
    } catch {
      setErrorMsg(
        'Password recovery endpoint is not reachable yet (scheduled for Phase 3 backend integration).',
      );
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-cyan-soft)] text-[var(--accent-cyan)]">
            <Mail className="h-4 w-4" />
          </div>
          <CardTitle>Password Recovery</CardTitle>
          <CardDescription>
            Request a secure password reset link for your SMARTSCHED account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--accent-mint)]/30 bg-[var(--accent-mint-soft)] p-3.5 text-xs text-[var(--accent-mint)]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  If an active account matches that email, recovery instructions have been queued.
                </span>
              </div>
              <Button asChild variant="secondary" className="w-full">
                <Link to="/login">Return to Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Input
                label="University Email"
                type="email"
                placeholder="name@university.edu.in"
                error={errors.email?.message}
                {...register('email')}
              />
              {errorMsg && (
                <p role="alert" className="text-xs text-[var(--accent-amber)]">
                  {errorMsg}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Recovery Link'}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/login">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
