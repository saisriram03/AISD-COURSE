import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <Card className="w-full text-center">
        <CardHeader className="items-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-violet-soft)] text-[var(--accent-violet)]">
            <Compass className="h-6 w-6" />
          </div>
          <CardTitle>Page Not Found</CardTitle>
          <CardDescription>
            The requested scheduling route does not exist or has moved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/">Go Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
