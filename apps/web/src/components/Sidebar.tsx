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

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-white border-r border-gray-100 min-h-screen sticky top-0 h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100 shrink-0">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm leading-none">PG Manager</p>
          <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Operations Console</p>
        </div>
      </div>

      {/* Nav */}
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
                    className={cn(
                      'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600',
                      )}
                    />
                    <span className="flex-1">{label}</span>
                    {isActive && (
                      <ChevronRight className="w-3 h-3 text-primary-400 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 pt-3 border-t border-gray-100 shrink-0 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user ? getInitials(user.name) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate leading-none">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-150 group"
        >
          <LogOut className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-red-500 transition-colors" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
