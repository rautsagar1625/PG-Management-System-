'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
  type NotificationType,
} from '@/lib/notifications-api';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<NotificationType, { emoji: string; color: string }> = {
  RENT_DUE:          { emoji: '📅', color: 'bg-yellow-50' },
  RENT_OVERDUE:      { emoji: '⚠️', color: 'bg-red-50' },
  PAYMENT_RECEIVED:  { emoji: '✅', color: 'bg-green-50' },
  MOVE_IN_CONFIRMED: { emoji: '🏠', color: 'bg-blue-50' },
  MOVE_OUT_INITIATED: { emoji: '📦', color: 'bg-orange-50' },
  COMPLAINT_ASSIGNED: { emoji: '🔧', color: 'bg-purple-50' },
  COMPLAINT_RESOLVED: { emoji: '✔️', color: 'bg-green-50' },
  ANNOUNCEMENT:      { emoji: '📢', color: 'bg-indigo-50' },
  SYSTEM:            { emoji: '🔔', color: 'bg-gray-50' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getNotifications(),
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const readMut = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readAllMut = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => readAllMut.mutate()}
                  disabled={readAllMut.isPending}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50"
                >
                  <CheckCheck className="w-3 h-3" />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => <NotifItem key={n.id} n={n} onRead={() => readMut.mutate(n.id)} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotifItem({ n, onRead }: { n: Notification; onRead: () => void }) {
  const cfg = TYPE_CONFIG[n.type] ?? { emoji: '🔔', color: 'bg-gray-50' };
  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors',
        !n.isRead && 'bg-blue-50/40',
      )}
    >
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base', cfg.color)}>
        {cfg.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 leading-snug">{n.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
        <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
      </div>
      {!n.isRead && (
        <button
          onClick={onRead}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 shrink-0 mt-0.5"
          aria-label="Mark as read"
        >
          <Check className="w-3.5 h-3.5 text-gray-400" />
        </button>
      )}
    </div>
  );
}
