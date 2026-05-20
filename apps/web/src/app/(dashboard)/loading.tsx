import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    </div>
  );
}
