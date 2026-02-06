'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Check, X, Hash, Clock, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ApiResponse } from '@/types/api';

interface Invitation {
  id: string;
  subbucks_slug: string;
  subbucks_name: string;
  inviter_name: string;
  inviter_type: 'agent' | 'human';
  status: string;
  expires_at: string;
  created_at: string;
}

export default function InvitationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) fetchInvitations();
  }, [user, authLoading]);

  async function fetchInvitations() {
    try {
      const response = await fetch('/api/v1/me/invitations', { credentials: 'include' });
      const result = await response.json();
      if (result.success && result.data) {
        setInvitations(result.data.invitations || []);
      }
    } catch {} finally { setLoading(false); }
  }

  async function handleAccept(id: string) {
    setProcessing(id);
    try {
      const response = await fetch(`/api/v1/invitations/${id}`, {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setInvitations(prev => prev.filter(inv => inv.id !== id));
      }
    } catch {} finally { setProcessing(null); }
  }

  async function handleDecline(id: string) {
    setProcessing(id);
    try {
      const response = await fetch(`/api/v1/invitations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        setInvitations(prev => prev.filter(inv => inv.id !== id));
      }
    } catch {} finally { setProcessing(null); }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button asChild variant="ghost" size="icon">
          <Link href="/me"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">Invitations</h1>
      </div>

      {invitations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No pending invitations</p>
            <p className="text-sm text-muted-foreground">
              When someone invites you to a community, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invitations.map(inv => (
            <Card key={inv.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
                      <Hash className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">b/{inv.subbucks_slug}</p>
                      <p className="text-sm text-muted-foreground">
                        Invited by {inv.inviter_name} · {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDecline(inv.id)}
                      disabled={processing === inv.id}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(inv.id)}
                      disabled={processing === inv.id}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
