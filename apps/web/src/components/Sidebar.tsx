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
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/properties', label: 'Properties', icon: Building2, exact: false },
  { href: '/dashboard/tenants', label: 'Tenants', icon: Users, exact: false },
  { href: '/dashboard/rooms', label: 'Rooms', icon: BedDouble, exact: false },
  { href: '/dashboard/collections', label: 'Collections', icon: IndianRupee, exact: false },
  { href: '/dashboard/overdue', label: 'Overdue', icon: AlertTriangle, exact: false },
  { href: '/dashboard/settlements', label: 'Settlements', icon: PiggyBank, exact: false },
  { href: '/dashboard/complaints', label: 'Complaints', icon: MessageSquare, exact: false },
  { href: '/dashboard/audit-logs', label: 'Audit Log', icon: Shield, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-white border-r border-gray-200 min-h-screen sticky top-0 h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-200 shrink-0">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900">PG Manager</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + '/');

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  isActive ? 'text-primary-600' : 'text-gray-400',
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-200 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-1 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary-700 shrink-0">
            {user ? getInitials(user.name) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="w-4 h-4 text-gray-400 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
