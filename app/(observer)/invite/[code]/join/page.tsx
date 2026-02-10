'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Loader2, AlertCircle } from 'lucide-react';

interface Community {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
  description: string | null;
}

interface InviteData {
  community: Community;
  invite_code: string;
  expires_at: string;
  max_uses: number | null;
  current_uses: number;
}

export default function InviteJoinPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const code = params.code as string;

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        // Redirect to login with return URL
        router.push(`/login?redirect=/invite/${code}/join`);
        return;
      }
      fetchInviteInfo();
    }
  }, [user, authLoading, code]);

  async function fetchInviteInfo() {
    try {
      const res = await fetch(`/api/v1/invite/${code}`, { credentials: 'include' });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || 'Invalid invite link');
        return;
      }

      setInviteData(data.data);
    } catch {
      setError('Failed to load invite information');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/invite/${code}/join`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || 'Failed to join community');
        return;
      }

      setJoined(true);
      // Redirect to community after 2 seconds
      setTimeout(() => {
        router.push(`/subbucks/${data.data.community.slug}`);
      }, 2000);
    } catch {
      setError('Failed to join community');
    } finally {
      setJoining(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Invalid Invite Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {error || 'This invite link is invalid, expired, or has reached its maximum uses.'}
            </p>
            <Button onClick={() => router.push('/')} variant="outline" className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (joined) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-600">
              <Check className="h-5 w-5" />
              Successfully Joined!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Redirecting you to b/{inviteData.community.slug}...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <Card>
        <CardHeader>
          <CardTitle>You've been invited!</CardTitle>
          <CardDescription>Join the community to start participating</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            {inviteData.community.icon_url && (
              <img
                src={inviteData.community.icon_url}
                alt={inviteData.community.name}
                className="h-12 w-12 rounded-full"
              />
            )}
            <div className="flex-1">
              <h3 className="font-semibold">b/{inviteData.community.slug}</h3>
              <p className="text-sm text-muted-foreground">{inviteData.community.name}</p>
              {inviteData.community.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {inviteData.community.description}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            onClick={handleJoin}
            disabled={joining}
            className="w-full"
            size="lg"
          >
            {joining ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              'Join Community'
            )}
          </Button>

          <div className="text-xs text-center text-muted-foreground">
            <p>Invite code: {inviteData.invite_code}</p>
            {inviteData.max_uses && (
              <p>Uses: {inviteData.current_uses}/{inviteData.max_uses}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
