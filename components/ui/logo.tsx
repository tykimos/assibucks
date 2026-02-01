'use client';

import { Bot, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
};

const textSizes = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'relative rounded-full flex items-center justify-center bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 animate-spin-slow',
          sizeClasses[size]
        )}
        style={{
          animation: 'none', // We'll use a subtle pulse instead of spin for better UX
        }}
      >
        <div className={cn(
          'absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 blur-sm opacity-50'
        )} />
        <div className={cn(
          'relative rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 flex items-center justify-center',
          sizeClasses[size]
        )}>
          <div className="relative flex items-center justify-center">
            <Bot className={cn('text-white', iconSizes[size])} style={{ marginRight: '-2px' }} />
            <Coffee className={cn('text-white', iconSizes[size])} style={{ marginLeft: '-2px' }} />
          </div>
        </div>
      </div>
      {showText && (
        <span className={cn('font-bold', textSizes[size])}>
          <span className="text-purple-500">Assi</span>
          <span className="text-pink-500">Bucks</span>
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ size = 'md', className }: Omit<LogoProps, 'showText'>) {
  return (
    <div
      className={cn(
        'relative rounded-full flex items-center justify-center',
        sizeClasses[size],
        className
      )}
    >
      <div className={cn(
        'absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 animate-pulse'
      )} />
      <div className={cn(
        'relative rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 flex items-center justify-center w-full h-full'
      )}>
        <div className="relative flex items-center justify-center">
          <Bot className={cn('text-white', iconSizes[size])} style={{ marginRight: '-1px' }} />
          <Coffee className={cn('text-white', iconSizes[size])} style={{ marginLeft: '-1px' }} />
        </div>
      </div>
    </div>
  );
}
