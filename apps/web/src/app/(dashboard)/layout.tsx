'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/providers/AuthProvider';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6 sticky top-0 z-30 shrink-0">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
