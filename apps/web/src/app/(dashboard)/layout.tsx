'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/providers/AuthProvider';
import { Loader2 } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/properties': 'Properties',
  '/dashboard/tenants': 'Tenants',
  '/dashboard/rooms': 'Rooms',
  '/dashboard/collections': 'Collections',
  '/dashboard/overdue': 'Overdue Tenants',
  '/dashboard/settlements': 'Settlements',
  '/dashboard/complaints': 'Complaints',
  '/dashboard/audit-logs': 'Audit Log',
  '/dashboard/payments': 'Payments',
};

function getPageTitle(pathname: string): string {
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];
  // dynamic segments like /dashboard/tenants/[id]
  const base = '/' + pathname.split('/').slice(1, 3).join('/');
  if (BREADCRUMB_MAP[base]) return BREADCRUMB_MAP[base];
  return 'Dashboard';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-auto min-w-0">
        {/* Top header */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30 shrink-0">
          {/* Page title / breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-gray-800 truncate">{pageTitle}</h2>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <div className={cn(
              'w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center',
              'text-xs font-bold text-white select-none',
            )}>
              {user ? getInitials(user.name) : '?'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
