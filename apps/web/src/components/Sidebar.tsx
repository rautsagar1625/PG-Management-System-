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
  X,
  UserPlus,
  UtensilsCrossed,
  CalendarCheck,
  TrendingUp,
  CreditCard,
  Settings,
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
      { href: '/dashboard/leads', label: 'Leads', icon: UserPlus, exact: false },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/collections', label: 'Collections', icon: IndianRupee, exact: false },
      { href: '/dashboard/overdue', label: 'Overdue', icon: AlertTriangle, exact: false },
      { href: '/dashboard/settlements', label: 'Settlements', icon: PiggyBank, exact: false },
      { href: '/dashboard/autopay', label: 'Autopay', icon: CreditCard, exact: false },
    ],
  },
  {
    label: 'Support',
    items: [
      { href: '/dashboard/complaints', label: 'Complaints', icon: MessageSquare, exact: false },
      { href: '/dashboard/food-menu', label: 'Food Menu', icon: UtensilsCrossed, exact: false },
      { href: '/dashboard/attendance', label: 'Attendance', icon: CalendarCheck, exact: false },
      { href: '/dashboard/audit-logs', label: 'Audit Log', icon: Shield, exact: false },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/dashboard/analytics', label: 'Analytics', icon: TrendingUp, exact: false },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/dashboard/settings', label: 'Settings', icon: Settings, exact: false },
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
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'w-64 shrink-0 flex flex-col',
          'bg-gray-950',
          'md:sticky md:top-0 md:h-screen',
          'fixed inset-y-0 left-0 z-50 h-full md:relative md:z-auto',
          isOpen ? 'translate-x-0 animate-slide-in-left' : '-translate-x-full md:translate-x-0',
          'transition-transform duration-[250ms] ease-out md:transition-none',
        )}
        aria-label="Navigation"
      >
        {/* Brand header */}
        <div
          className="flex items-center justify-between px-5 h-16 shrink-0 border-b border-white/10"
          style={{ background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center border border-white/20 shadow-inner">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-none tracking-tight">PG Manager</p>
              <p className="text-[10px] text-indigo-200/70 mt-0.5 font-medium">Operations Console</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-3 mb-1">
                {group.label}
              </p>
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
                        'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200',
                      )}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-indigo-400" />
                      )}
                      <Icon
                        className={cn(
                          'w-4 h-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-indigo-300'
                            : 'text-gray-500 group-hover:text-gray-300',
                        )}
                      />
                      <span className="flex-1">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-4 pt-3 border-t border-white/10 shrink-0 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
            >
              {user ? getInitials(user.name) : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-100 truncate leading-none">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => { signOut(); onClose?.(); }}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150 group"
          >
            <LogOut className="w-4 h-4 shrink-0 text-gray-600 group-hover:text-red-400 transition-colors" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
