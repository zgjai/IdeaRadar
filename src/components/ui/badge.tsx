import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'rank-s' | 'rank-a' | 'rank-b' | 'rank-c' | 'rank-d';
  children: ReactNode;
}

export function Badge({ className, variant = 'default', children }: BadgeProps) {
  const variants = {
    default: 'bg-blue-100 text-blue-900',
    secondary: 'bg-slate-100 text-slate-800',
    destructive: 'bg-red-100 text-red-900',
    outline: 'border border-slate-300 text-slate-700',
    success: 'bg-green-100 text-green-900',
    warning: 'bg-yellow-100 text-yellow-900',
    green: 'bg-green-100 text-green-900',
    yellow: 'bg-yellow-100 text-yellow-900',
    red: 'bg-red-100 text-red-900',
    blue: 'bg-blue-100 text-blue-900',
    purple: 'bg-purple-100 text-purple-900',
    'rank-s': 'bg-gradient-to-r from-amber-400 to-amber-600 text-white font-bold shadow-sm',
    'rank-a': 'bg-gradient-to-r from-blue-400 to-blue-600 text-white font-bold',
    'rank-b': 'bg-gradient-to-r from-green-400 to-green-600 text-white font-semibold',
    'rank-c': 'bg-slate-200 text-slate-700 font-semibold',
    'rank-d': 'bg-slate-100 text-slate-500 font-medium',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
