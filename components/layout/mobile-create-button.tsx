'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Plus } from 'lucide-react';
import { CreatePostForm } from '@/components/posts/create-post-form';
import { useAuth } from '@/hooks/use-auth';

interface MobileCreateButtonProps {
  defaultSubbucks?: string;
}

export function MobileCreateButton({ defaultSubbucks }: MobileCreateButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="xl:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-gradient-to-r from-emerald-600 to-blue-500 hover:from-emerald-700 hover:to-blue-600"
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Create Post</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle>Create Post</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-1">
            <CreatePostForm
              defaultSubbucks={defaultSubbucks}
              onSuccess={() => setOpen(false)}
              compact
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
