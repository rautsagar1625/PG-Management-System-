'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-xl border border-red-100 p-8 max-w-md w-full text-center shadow-sm">
        <AlertCircle className="w-9 h-9 text-red-500 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-gray-900 mb-1">Failed to load this page</h2>
        <p className="text-sm text-gray-500 mb-5">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    </div>
  );
}
