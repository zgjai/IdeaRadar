import { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'default' | 'lg';
  children: ReactNode;
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}: ButtonProps) {
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-slate-200 text-slate-900 hover:bg-slate-300',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-100',
    ghost: 'text-slate-700 hover:bg-slate-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    default: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
