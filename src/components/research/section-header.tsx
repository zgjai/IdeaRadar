'use client';

import type { ReactNode } from 'react';

interface SectionHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  accentColor?: string;
}

export function SectionHeader({ icon, title, subtitle, accentColor = '#0d9488' }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-sora text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="h-px flex-1 max-w-[80px]" style={{ background: `linear-gradient(to right, ${accentColor}30, transparent)` }} />
    </div>
  );
}
