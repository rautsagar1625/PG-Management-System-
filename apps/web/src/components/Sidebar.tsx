'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  LayoutDashboard,
  Users,
  BedDouble,
  IndianRupee,
  MessageSquare,
  LogOut,
  AlertTriangle,
  PiggyBank,
  Shield,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/dashboard/properties', label: 'Properties', icon: Building2, exact: false },
      { href: '/dashboard/tenants', label: 'Tenants', icon: Users, exact: false },
      { href: '/dashboard/rooms', label: 'Rooms', icon: BedDouble, exact: false },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/collections', label: 'Collections', icon: IndianRupee, exact: false },
      { href: '/dashboard/overdue', label: 'Overdue', icon: AlertTriangle, exact: false },
      { href: '/dashboard/settlements', label: 'Settlements', icon: PiggyBank, exact: false },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/dashboard/complaints', label: 'Complaints', icon: MessageSquare, exact: false },
      { href: '/dashboard/audit-logs', label: 'Audit Log', icon: Shield, exact: false },
    ],
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          // Base styles
          'w-64 shrink-0 flex flex-col',
          'bg-white dark:bg-gray-900',
          'border-r border-gray-100 dark:border-gray-800',
          // Desktop: sticky in normal flow
          'md:sticky md:top-0 md:h-screen',
          // Mobile: fixed drawer with slide animation
          'fixed inset-y-0 left-0 z-50 h-full md:relative md:z-auto',
          isOpen ? 'translate-x-0 animate-slide-in-left' : '-translate-x-full md:translate-x-0',
          'transition-transform duration-[250ms] ease-out md:transition-none',
        )}
        aria-label="Navigation"
      >
        {/* Logo row */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-none">PG Manager</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-medium">Operations Console</p>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="section-label">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, exact }) => {
                  const isActive = exact
                    ? pathname === href
                    : pathname === href || pathname.startsWith(href + '/');

                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={cn(
                        'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-4 h-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300',
                        )}
                      />
                      <span className="flex-1">{label}</span>
                      {isActive && (
                        <ChevronRight className="w-3 h-3 text-primary-400 dark:text-primary-500 shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-4 pt-3 border-t border-gray-100 dark:border-gray-800 shrink-0 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user ? getInitials(user.name) : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-none">
                {user?.name}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => { signOut(); onClose?.(); }}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150 group"
          >
            <LogOut className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-red-500 transition-colors" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
