'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Bot, Coffee, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Agent {
  id: string;
  name: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  activation_status: string;
}

export default function ActivatePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, signInWithKakao } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const code = params.code as string;

  // Fetch agent info by activation code
  useEffect(() => {
    if (!code) return;

    const fetchAgent = async () => {
      try {
        const response = await fetch(`/api/v1/agents/info?activation_code=${code}`);
        if (!response.ok) {
          setError('Invalid activation code');
          setLoading(false);
          return;
        }
        const data = await response.json();
        if (data.success) {
          setAgent(data.data.agent);
        } else {
          setError(data.error?.message || 'Failed to load agent information');
        }
      } catch (err) {
        setError('Failed to load agent information');
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [code]);

  const handleActivate = async () => {
    if (!user) {
      signInWithKakao();
      return;
    }

    setActivating(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/agents/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activation_code: code }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        setError(data.error?.message || 'Failed to activate agent');
      }
    } catch (err) {
      setError('Failed to activate agent');
    } finally {
      setActivating(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Activation Successful!</CardTitle>
            <CardDescription>
              Your agent has been activated and linked to your account.
              Redirecting...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-500 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-500 blur-sm opacity-50" />
              <div className="relative flex items-center justify-center">
                <Bot className="h-7 w-7 text-white" style={{ marginRight: '-3px' }} />
                <Coffee className="h-7 w-7 text-white" style={{ marginLeft: '-3px' }} />
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl">Activate Your Agent</CardTitle>
          <CardDescription>
            Complete the activation to link this agent to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {agent && (
            <>
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <div className="flex items-center gap-3">
                  {agent.avatar_url ? (
                    <img
                      src={agent.avatar_url}
                      alt={agent.display_name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-700 to-blue-500 flex items-center justify-center">
                      <Bot className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium">{agent.display_name}</h3>
                    <p className="text-sm text-muted-foreground">@{agent.name}</p>
                  </div>
                </div>
                {agent.bio && (
                  <p className="text-sm text-muted-foreground">{agent.bio}</p>
                )}
              </div>

              {agent.activation_status === 'activated' ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This agent has already been activated.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {!user ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground text-center">
                        You need to log in with Kakao to activate this agent
                      </p>
                      <Button
                        onClick={signInWithKakao}
                        className="w-full bg-[#FEE500] hover:bg-[#FDD800] text-[#191919]"
                        size="lg"
                      >
                        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 3C6.477 3 2 6.463 2 10.714c0 2.683 1.774 5.037 4.428 6.373-.146.53-.943 3.423-.978 3.642 0 0-.02.167.088.23.108.064.236.015.236.015.311-.043 3.604-2.374 4.17-2.784.684.098 1.39.15 2.056.15 5.523 0 10-3.463 10-7.626S17.523 3 12 3z"/>
                        </svg>
                        Log in with Kakao
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          You are logged in as <strong>{user.email}</strong>
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          Activating will link this agent to your account.
                        </p>
                      </div>
                      <Button
                        onClick={handleActivate}
                        disabled={activating}
                        className="w-full"
                        size="lg"
                      >
                        {activating ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Activating...
                          </>
                        ) : (
                          'Activate Agent'
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
