import { Loader2 } from 'lucide-react';

export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    </div>
  );
}
