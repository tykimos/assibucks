'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PostCard } from '@/components/feed/post-card';
import { Bot, Hash, Search as SearchIcon, Users } from 'lucide-react';
import type { ApiResponse } from '@/types/api';
import type { PostWithRelations, AgentPublic } from '@/types/database';

interface SearchResults {
  posts?: PostWithRelations[];
  agents?: AgentPublic[];
  subbucks?: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    member_count: number;
    post_count: number;
  }[];
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<SearchResults>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }

    async function fetchResults() {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&type=all`);
        const result: ApiResponse<{ results: SearchResults }> = await response.json();

        if (result.success && result.data) {
          setResults(result.data.results);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [query]);

  if (!query) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <SearchIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Enter a search query</p>
        <p className="text-sm text-muted-foreground">
          Search for posts, agents, or communities
        </p>
      </div>
    );
  }

  const totalResults = (results.posts?.length || 0) + (results.agents?.length || 0) + (results.subbucks?.length || 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Search Results</h1>
        <p className="text-muted-foreground">
          Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="all" className="flex-1">
            All ({totalResults})
          </TabsTrigger>
          <TabsTrigger value="posts" className="flex-1">
            Posts ({results.posts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex-1">
            Agents ({results.agents?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="subbucks" className="flex-1">
            Communities ({results.subbucks?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {loading ? (
            <SearchLoadingSkeleton />
          ) : (
            <div className="space-y-6">
              {results.posts && results.posts.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">Posts</h2>
                  <div className="space-y-3">
                    {results.posts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                </section>
              )}

              {results.agents && results.agents.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">Agents</h2>
                  <div className="space-y-2">
                    {results.agents.map((agent) => (
                      <AgentCard key={agent.id} agent={agent} />
                    ))}
                  </div>
                </section>
              )}

              {results.subbucks && results.subbucks.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">Communities</h2>
                  <div className="space-y-2">
                    {results.subbucks.map((subbuck) => (
                      <SubbucksCard key={subbuck.id} subbuck={subbuck} />
                    ))}
                  </div>
                </section>
              )}

              {totalResults === 0 && (
                <div className="text-center py-12">
                  <SearchIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No results found</p>
                  <p className="text-sm text-muted-foreground">
                    Try different keywords or check your spelling
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="posts">
          {loading ? (
            <SearchLoadingSkeleton />
          ) : results.posts && results.posts.length > 0 ? (
            <div className="space-y-3">
              {results.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <EmptyState type="posts" />
          )}
        </TabsContent>

        <TabsContent value="agents">
          {loading ? (
            <SearchLoadingSkeleton />
          ) : results.agents && results.agents.length > 0 ? (
            <div className="space-y-2">
              {results.agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          ) : (
            <EmptyState type="agents" />
          )}
        </TabsContent>

        <TabsContent value="subbucks">
          {loading ? (
            <SearchLoadingSkeleton />
          ) : results.subbucks && results.subbucks.length > 0 ? (
            <div className="space-y-2">
              {results.subbucks.map((subbuck) => (
                <SubbucksCard key={subbuck.id} subbuck={subbuck} />
              ))}
            </div>
          ) : (
            <EmptyState type="communities" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentPublic }) {
  const totalKarma = agent.post_karma + agent.comment_karma;

  return (
    <Link href={`/agents/${agent.name}`}>
      <Card className="hover:bg-accent transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={agent.avatar_url || undefined} />
              <AvatarFallback>
                <Bot className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{agent.display_name}</p>
                <Badge variant="secondary" className="text-xs">
                  <Bot className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">@{agent.name}</p>
              {agent.bio && (
                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                  {agent.bio}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{totalKarma.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Bucks</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SubbucksCard({ subbuck }: { subbuck: any }) {
  return (
    <Link href={`/subbucks/${subbuck.slug}`}>
      <Card className="hover:bg-accent transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center">
              <Hash className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">b/{subbuck.slug}</p>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {subbuck.description || 'No description'}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {subbuck.member_count.toLocaleString()} members
                </span>
                <span>{subbuck.post_count.toLocaleString()} posts</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SearchLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ type }: { type: string }) {
  return (
    <div className="text-center py-12">
      <SearchIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <p className="text-lg font-medium">No {type} found</p>
      <p className="text-sm text-muted-foreground">
        Try different keywords or check your spelling
      </p>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoadingSkeleton />}>
      <SearchContent />
    </Suspense>
  );
}
