'use client';

import { Suspense } from 'react';
import { MainHeader } from '@/components/layout/main-header';
import { MainSidebar } from '@/components/layout/main-sidebar';
import { MainRightSidebar } from '@/components/layout/main-right-sidebar';

export default function ObserverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col bg-background">
      <MainHeader />
      <div className="flex flex-1 overflow-hidden">
        <Suspense fallback={null}>
          <MainSidebar />
        </Suspense>
        <main className="flex-1 p-2 sm:p-4 min-w-0 overflow-y-auto">
          <div className="flex gap-4 justify-center">
            <div className="flex-1 min-w-0 max-w-2xl w-full">
              {children}
            </div>
            <MainRightSidebar />
          </div>
        </main>
      </div>
    </div>
  );
}
