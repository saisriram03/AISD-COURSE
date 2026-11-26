import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, RefreshCw } from 'lucide-react';
import { fetchNotifications, markNotificationRead } from '@/services/timetableApi';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 10_000,
  });

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const items = notificationsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Notification Center</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Live timetable publications, modifications, and scheduling alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="cyan">{items.filter((i) => !i.is_read).length} Unread</Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void notificationsQuery.refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {notificationsQuery.isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-[var(--bg-elevated)]" />
      ) : items.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[var(--accent-cyan)]" />
              <CardTitle className="text-base">No notifications yet</CardTitle>
            </div>
            <CardDescription>
              Schedule updates published by the Department Admin will appear here automatically.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <CardContent className="flex items-start justify-between gap-4 space-y-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.is_read ? 'neutral' : 'mint'}>
                      {item.is_read ? 'Read' : 'New'}
                    </Badge>
                    <span className="font-display text-sm font-semibold">{item.title}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{item.message}</p>
                  <p className="font-mono text-[11px] text-[var(--text-muted)]">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
                {!item.is_read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleMarkRead(item.id)}
                    aria-label="Mark notification as read"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
