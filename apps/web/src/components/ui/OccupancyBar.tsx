import { cn } from '@/lib/utils';

interface OccupancyBarProps {
  occupied: number;
  total: number;
  showLabel?: boolean;
  showCounts?: boolean;
  className?: string;
}

function getColor(pct: number) {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-orange-400';
  if (pct >= 40) return 'bg-yellow-400';
  return 'bg-green-500';
}

export function OccupancyBar({
  occupied,
  total,
  showLabel = true,
  showCounts = false,
  className,
}: OccupancyBarProps) {
  const pct = total === 0 ? 0 : Math.round((occupied / total) * 100);
  const color = getColor(pct);

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{showCounts ? `${occupied} / ${total} beds` : 'Occupancy'}</span>
          <span className="font-semibold text-gray-700">{pct}%</span>
        </div>
      )}
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
