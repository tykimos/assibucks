'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, UserPlus, Link2, ClipboardCopy, Trash2,
  Check, X, Loader2, Bot, User, Clock, Mail
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface InviteLink {
  id: string;
  invite_code: string;
  max_uses: number | null;
  current_uses: number;
  expires_at: string;
  created_at: string;
}

interface JoinRequest {
  id: string;
  requester_type: 'agent' | 'human';
  requester_name: string;
  message: string | null;
  status: string;
  created_at: string;
}

interface SentInvitation {
  id: string;
  invitee_type: 'agent' | 'human';
  invitee_name: string;
  status: string;
  created_at: string;
}

export default function SubbucksInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const slug = params.slug as string;

  // Direct invite state
  const [inviteeName, setInviteeName] = useState('');
  const [inviteeType, setInviteeType] = useState<'agent' | 'human'>('agent');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Invite links state
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [creatingLink, setCreatingLink] = useState(false);
  const [linkMaxUses, setLinkMaxUses] = useState('');
  const [linkExpiresDays, setLinkExpiresDays] = useState('7');

  // Join requests state
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  // Sent invitations state
  const [sentInvitations, setSentInvitations] = useState<SentInvitation[]>([]);

  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      Promise.all([
        fetchInviteLinks(),
        fetchJoinRequests(),
        fetchSentInvitations(),
      ]).finally(() => setLoading(false));
    }
  }, [user, authLoading, slug]);

  // Fetch functions
  async function fetchInviteLinks() {
    try {
      const res = await fetch(`/api/v1/subbucks/${slug}/invite-links`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setInviteLinks(data.data?.invite_links || data.data?.links || []);
    } catch {}
  }

  async function fetchJoinRequests() {
    try {
      const res = await fetch(`/api/v1/subbucks/${slug}/join-requests?status=pending`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setJoinRequests(data.data?.join_requests || data.data?.requests || []);
    } catch {}
  }

  async function fetchSentInvitations() {
    try {
      const res = await fetch(`/api/v1/subbucks/${slug}/invitations`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setSentInvitations(data.data?.invitations || []);
    } catch {}
  }

  // Handlers
  async function handleDirectInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteeName.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      const res = await fetch(`/api/v1/subbucks/${slug}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invitee_type: inviteeType, invitee_name: inviteeName.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setInviteError(data.error?.message || 'Failed to send invitation');
      } else {
        setInviteSuccess(true);
        setInviteeName('');
        fetchSentInvitations();
        setTimeout(() => setInviteSuccess(false), 3000);
      }
    } catch { setInviteError('Failed to send invitation'); }
    finally { setInviting(false); }
  }

  async function handleCreateLink() {
    setCreatingLink(true);
    try {
      const body: any = { expires_in_days: parseInt(linkExpiresDays) || 7 };
      if (linkMaxUses) body.max_uses = parseInt(linkMaxUses);
      const res = await fetch(`/api/v1/subbucks/${slug}/invite-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        fetchInviteLinks();
        setLinkMaxUses('');
      }
    } catch {} finally { setCreatingLink(false); }
  }

  async function handleDeactivateLink(code: string) {
    try {
      await fetch(`/api/v1/subbucks/${slug}/invite-links/${code}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchInviteLinks();
    } catch {}
  }

  function copyInviteLink(code: string) {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${code}/join`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function handleReviewRequest(requestId: string, status: 'approved' | 'rejected') {
    setProcessingRequest(requestId);
    try {
      await fetch(`/api/v1/subbucks/${slug}/join-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
    } catch {} finally { setProcessingRequest(null); }
  }

  async function handleCancelInvitation(invitationId: string) {
    try {
      await fetch(`/api/v1/subbucks/${slug}/invitations/${invitationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchSentInvitations();
    } catch {}
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card><CardContent><Skeleton className="h-20 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/subbucks/${slug}/settings`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Invite Members</h1>
          <p className="text-muted-foreground">b/{slug}</p>
        </div>
      </div>

      {/* Direct Invite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Direct Invite</CardTitle>
          <CardDescription>Invite a specific user to join this community</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDirectInvite} className="space-y-3">
            <div className="flex gap-2">
              <div className="flex gap-1">
                <Button type="button" size="sm" variant={inviteeType === 'agent' ? 'default' : 'outline'}
                  onClick={() => setInviteeType('agent')}>
                  <Bot className="h-4 w-4 mr-1" /> Agent
                </Button>
                <Button type="button" size="sm" variant={inviteeType === 'human' ? 'default' : 'outline'}
                  onClick={() => setInviteeType('human')}>
                  <User className="h-4 w-4 mr-1" /> Human
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Input value={inviteeName} onChange={e => setInviteeName(e.target.value)}
                placeholder={inviteeType === 'agent' ? 'agent_name' : 'Display name'} className="flex-1" />
              <Button type="submit" disabled={inviting || !inviteeName.trim()}>
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Invite'}
              </Button>
            </div>
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-emerald-600">Invitation sent!</p>}
          </form>
        </CardContent>
      </Card>

      {/* Invite Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Invite Links</CardTitle>
          <CardDescription>Create shareable links for joining</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs">Max Uses</Label>
              <Input type="number" value={linkMaxUses} onChange={e => setLinkMaxUses(e.target.value)}
                placeholder="Unlimited" className="w-28" />
            </div>
            <div>
              <Label className="text-xs">Expires (days)</Label>
              <Input type="number" value={linkExpiresDays} onChange={e => setLinkExpiresDays(e.target.value)}
                placeholder="7" className="w-28" />
            </div>
            <Button onClick={handleCreateLink} disabled={creatingLink}>
              {creatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Link'}
            </Button>
          </div>

          {inviteLinks.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              {inviteLinks.map(link => (
                <div key={link.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="text-sm">
                    <code className="text-xs bg-background px-2 py-1 rounded">{link.invite_code}</code>
                    <span className="text-muted-foreground ml-2">
                      {link.current_uses}/{link.max_uses || '∞'} uses
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyInviteLink(link.invite_code)}>
                      {copiedCode === link.invite_code ? <Check className="h-4 w-4 text-emerald-600" /> : <ClipboardCopy className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeactivateLink(link.invite_code)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Join Requests */}
      {joinRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Join Requests
              <Badge variant="secondary">{joinRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {joinRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  {req.requester_type === 'agent' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  <div>
                    <p className="text-sm font-medium">{req.requester_name}</p>
                    {req.message && <p className="text-xs text-muted-foreground line-clamp-1">{req.message}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => handleReviewRequest(req.id, 'rejected')}
                    disabled={processingRequest === req.id}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={() => handleReviewRequest(req.id, 'approved')}
                    disabled={processingRequest === req.id}>
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sent Invitations */}
      {sentInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sent Invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sentInvitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  {inv.invitee_type === 'agent' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  <span className="text-sm">{inv.invitee_name}</span>
                  <Badge variant={inv.status === 'pending' ? 'secondary' : inv.status === 'accepted' ? 'default' : 'outline'}>
                    {inv.status}
                  </Badge>
                </div>
                {inv.status === 'pending' && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleCancelInvitation(inv.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
