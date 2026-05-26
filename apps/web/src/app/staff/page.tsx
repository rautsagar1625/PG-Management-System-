'use client';

import { Smartphone, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * STAFF users are redirected here from the web dashboard.
 * Staff operations (complaint updates, attendance, food menu)
 * are intentionally mobile-only — the web dashboard exposes
 * financial data that staff should not have access to.
 */
export default function StaffMobilePage() {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    // Clear session cookie
    document.cookie = 'pg_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">

        {/* Icon */}
        <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto">
          <Smartphone className="w-10 h-10 text-primary-600" />
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Use the Mobile App</h1>
          <p className="mt-2 text-gray-500 text-sm leading-relaxed">
            Your staff account gives you access to complaints, attendance, and food menu —
            all available in the <strong>PG Manager mobile app</strong>.
          </p>
        </div>

        {/* What you can do */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-left space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">What you can do on mobile</p>
          {[
            { emoji: '🔧', label: 'View & update complaints assigned to you' },
            { emoji: '📋', label: 'Mark daily attendance for tenants' },
            { emoji: '🍽️', label: 'Update the food menu for today' },
            { emoji: '👤', label: 'View your profile and shift details' },
          ].map(({ emoji, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xl">{emoji}</span>
              <span className="text-sm text-gray-700">{label}</span>
            </div>
          ))}
        </div>

        {/* App download links */}
        <div className="flex flex-col gap-3">
          <a
            href="https://apps.apple.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-3 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors"
          >
            🍎 Download on the App Store
          </a>
          <a
            href="https://play.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
          >
            🤖 Get it on Google Play
          </a>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors mx-auto"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
