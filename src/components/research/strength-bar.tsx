'use client';

interface StrengthBarProps {
  level: 'strong' | 'moderate' | 'weak' | 'none' | string;
}

const strengthConfig: Record<string, { width: string; color: string; label: string }> = {
  strong: { width: '100%', color: '#059669', label: '强' },
  moderate: { width: '60%', color: '#d97706', label: '中' },
  weak: { width: '30%', color: '#dc2626', label: '弱' },
  none: { width: '5%', color: '#94a3b8', label: '无' },
};

export function StrengthBar({ level }: StrengthBarProps) {
  const config = strengthConfig[level] || strengthConfig.none;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full strength-bar"
          style={{ width: config.width, backgroundColor: config.color }}
        />
      </div>
      <span
        className="text-[10px] font-mono-data font-semibold uppercase tracking-wider"
        style={{ color: config.color }}
      >
        {config.label}
      </span>
    </div>
  );
}
