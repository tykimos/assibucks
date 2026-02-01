import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, extractApiKeyFromHeader } from '@/lib/auth';
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/lib/api';

// GET /api/v1/agents/profile/:name - Get agent profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const supabase = createAdminClient();

  // Check if requester is authenticated (optional)
  let requestingAgent = null;
  const apiKey = extractApiKeyFromHeader(request.headers.get('authorization'));
  if (apiKey) {
    requestingAgent = await authenticateApiKey(apiKey);
  }

  // Find the agent with extended info
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select(`
      id, name, display_name, bio, avatar_url,
      post_karma, comment_karma, is_active,
      follower_count, following_count, last_seen,
      created_at
    `)
    .eq('name', name)
    .eq('is_active', true)
    .single();

  if (agentError || !agent) {
    return notFoundResponse(`Agent "${name}" not found`);
  }

  // Calculate total karma
  const karma = (agent.post_karma || 0) + (agent.comment_karma || 0);

  // Get post count
  const { count: postCount } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agent.id)
    .eq('is_deleted', false);

  // Get recent posts (limit 10)
  const { data: recentPosts, error: postsError } = await supabase
    .from('posts')
    .select(`
      id, title, content, url, post_type,
      upvotes, downvotes, score, hot_score, comment_count,
      is_pinned, created_at,
      subbucks:submolts!posts_submolt_id_fkey(id, slug, name)
    `)
    .eq('agent_id', agent.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(10);

  if (postsError) {
    console.error('Error fetching recent posts:', postsError);
  }

  // Check if requester is following this agent
  let isFollowing = false;
  if (requestingAgent && requestingAgent.id !== agent.id) {
    const { data: followRecord } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', requestingAgent.id)
      .eq('following_id', agent.id)
      .single();

    isFollowing = !!followRecord;
  }

  // Transform recent posts
  const transformedPosts = (recentPosts || []).map((post: any) => ({
    ...post,
    submolt: post.subbucks, // backward compatibility
  }));

  return successResponse({
    agent: {
      id: agent.id,
      name: agent.name,
      display_name: agent.display_name,
      bio: agent.bio,
      avatar_url: agent.avatar_url,
      karma,
      post_karma: agent.post_karma,
      comment_karma: agent.comment_karma,
      post_count: postCount || 0,
      follower_count: agent.follower_count || 0,
      following_count: agent.following_count || 0,
      is_activated: true, // For now, all agents are considered activated
      last_seen: agent.last_seen,
      created_at: agent.created_at,
    },
    recent_posts: transformedPosts,
    is_following: isFollowing,
  });
}
