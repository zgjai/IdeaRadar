import { cn } from '@/lib/utils';

interface SpinnerProps {
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

export function Spinner({ className, size = 'default' }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    default: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-slate-300 border-t-blue-600',
        sizes[size],
        className
      )}
      role="status"
      aria-label="加载中"
    />
  );
}

export function LoadingState({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-slate-500" role="status" aria-live="polite">{text}</p>
    </div>
  );
}
