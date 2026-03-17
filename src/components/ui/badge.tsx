import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'rank-s' | 'rank-a' | 'rank-b' | 'rank-c' | 'rank-d';
  children: ReactNode;
}

export function Badge({ className, variant = 'default', children }: BadgeProps) {
  const variants = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-slate-100 text-slate-800',
    destructive: 'bg-red-100 text-red-800',
    outline: 'border border-slate-300 text-slate-700',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    'rank-s': 'bg-red-100 text-red-700 font-semibold',
    'rank-a': 'bg-orange-100 text-orange-700 font-semibold',
    'rank-b': 'bg-yellow-100 text-yellow-700 font-semibold',
    'rank-c': 'bg-blue-100 text-blue-700 font-semibold',
    'rank-d': 'bg-gray-100 text-gray-700 font-semibold',
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
