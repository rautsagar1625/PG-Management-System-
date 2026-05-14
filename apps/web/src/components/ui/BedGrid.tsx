'use client';

import { cn } from '@/lib/utils';

export interface BedInfo {
  id: string;
  label: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'UNDER_MAINTENANCE';
  tenantName?: string;
  monthlyRent?: number;
}

const bedStatusStyles: Record<
  BedInfo['status'],
  { bg: string; dot: string; label: string }
> = {
  AVAILABLE: {
    bg: 'bg-green-50 border-green-200 text-green-800',
    dot: 'bg-green-400',
    label: 'Vacant',
  },
  OCCUPIED: {
    bg: 'bg-red-50 border-red-200 text-red-800',
    dot: 'bg-red-400',
    label: 'Occupied',
  },
  RESERVED: {
    bg: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    dot: 'bg-yellow-400',
    label: 'Reserved',
  },
  UNDER_MAINTENANCE: {
    bg: 'bg-gray-50 border-gray-200 text-gray-500',
    dot: 'bg-gray-400',
    label: 'Maint.',
  },
};

interface BedCardProps {
  bed: BedInfo;
  compact?: boolean;
  onClick?: (bed: BedInfo) => void;
}

function BedCard({ bed, compact = false, onClick }: BedCardProps) {
  const style = bedStatusStyles[bed.status];

  if (compact) {
    return (
      <div
        title={bed.tenantName ?? style.label}
        onClick={onClick ? () => onClick(bed) : undefined}
        className={cn(
          'inline-flex items-center gap-1.5 border rounded-md px-2 py-1 text-xs font-medium transition-colors',
          style.bg,
          onClick && 'cursor-pointer hover:opacity-80',
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', style.dot)} />
        <span>{bed.label}</span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick ? () => onClick(bed) : undefined}
      className={cn(
        'border rounded-xl p-3 min-w-[110px] transition-all',
        style.bg,
        onClick && 'cursor-pointer hover:shadow-md',
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold">Bed {bed.label}</span>
        <span className={cn('w-2 h-2 rounded-full', style.dot)} />
      </div>
      <p className="text-xs font-medium leading-tight">
        {bed.tenantName ?? style.label}
      </p>
      {bed.monthlyRent && (
        <p className="text-xs opacity-70 mt-0.5">
          ₹{bed.monthlyRent.toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
}

interface BedGridProps {
  beds: BedInfo[];
  compact?: boolean;
  onBedClick?: (bed: BedInfo) => void;
  className?: string;
}

export function BedGrid({ beds, compact = false, onBedClick, className }: BedGridProps) {
  if (beds.length === 0) {
    return <span className="text-xs text-gray-400">No beds configured</span>;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {beds.map((bed) => (
        <BedCard
          key={bed.id}
          bed={bed}
          compact={compact}
          onClick={onBedClick}
        />
      ))}
    </div>
  );
}
