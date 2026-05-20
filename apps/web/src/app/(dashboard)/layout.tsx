'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, Menu, Sun, Moon, LogOut, User } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme } from '@/providers/ThemeProvider';
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
  const base = '/' + pathname.split('/').slice(1, 3).join('/');
  if (BREADCRUMB_MAP[base]) return BREADCRUMB_MAP[base];
  return 'Dashboard';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
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
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-auto min-w-0">
        {/* Top header */}
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shrink-0">
          {/* Left: hamburger (mobile) + page title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {pageTitle}
            </h2>
          </div>

          {/* Right: theme toggle, notifications, profile */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4" />
                : <Moon className="w-4 h-4" />
              }
            </button>

            <NotificationBell />

            {/* Profile avatar + dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className={cn(
                  'w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center',
                  'text-xs font-bold text-white select-none ring-2 ring-transparent',
                  'hover:ring-primary-300 dark:hover:ring-primary-700 transition-all duration-150',
                  profileOpen && 'ring-primary-300 dark:ring-primary-700',
                )}
                aria-label="Account menu"
                aria-haspopup="true"
                aria-expanded={profileOpen}
              >
                {user ? getInitials(user.name) : '?'}
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50 animate-fade-in">
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {user ? getInitials(user.name) : '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Role badge */}
                  {user?.systemRole && (
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                        {user.systemRole.replace('_', ' ')}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="py-1">
                    <button
                      onClick={() => { setProfileOpen(false); signOut(); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-7 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
