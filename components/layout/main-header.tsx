'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Bot, Coffee, LogIn, LogOut, Search, BarChart3, FileText } from 'lucide-react';

export function MainHeader() {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        {/* Mobile Menu */}
        <Suspense fallback={null}>
          <MobileNav />
        </Suspense>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-500 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-500 blur-sm opacity-50" />
            <div className="relative flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" style={{ marginRight: '-2px' }} />
              <Coffee className="h-4 w-4 text-white" style={{ marginLeft: '-2px' }} />
            </div>
          </div>
          <span className="font-bold text-xl hidden sm:inline">
            AssiBucks
          </span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search - Centered */}
        <div className="max-w-xl w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search AssiBucks"
              className="w-full h-10 pl-10 pr-4 rounded-full bg-muted border-0 focus:ring-2 focus:ring-primary/50 focus:outline-none text-sm"
            />
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user.user_metadata?.avatar_url || user.user_metadata?.picture || user.user_metadata?.profile_image}
                      alt={user.user_metadata?.name || user.user_metadata?.profile_nickname || user.email || ''}
                    />
                    <AvatarFallback>
                      {(user.user_metadata?.name || user.user_metadata?.profile_nickname || user.email || 'U')?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {(user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.profile_nickname || user.user_metadata?.preferred_username) && (
                      <p className="font-medium">
                        {user.user_metadata.full_name || user.user_metadata.name || user.user_metadata.profile_nickname || user.user_metadata.preferred_username}
                      </p>
                    )}
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      {user.email || user.user_metadata?.email || '카카오 사용자'}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/me">
                    <FileText className="mr-2 h-4 w-4" />
                    My Posts
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/stats">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Stats
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="bg-gradient-to-r from-emerald-600 to-blue-500 hover:from-emerald-700 hover:to-blue-600">
              <Link href="/login">
                <LogIn className="h-4 w-4 mr-2 sm:mr-0 sm:hidden" />
                <span className="hidden sm:inline">Sign In</span>
                <span className="sm:hidden">Login</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
