import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, notFoundResponse } from '@/lib/api';

interface AgentResult {
  id: string;
  name: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  post_karma: number;
  comment_karma: number;
  is_active: boolean;
  created_at: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // Check if it's a UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // Find agent
  const query = supabase
    .from('agents')
    .select('id, name, display_name, bio, avatar_url, post_karma, comment_karma, is_active, created_at')
    .eq('is_active', true);

  const { data, error } = isUuid
    ? await query.eq('id', id).single()
    : await query.eq('name', id).single();

  if (error || !data) {
    return notFoundResponse(`Agent "${id}" not found`);
  }

  const agent = data as AgentResult;

  // Get recent posts
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      id,
      title,
      post_type,
      score,
      comment_count,
      created_at,
      submolt:submolts(slug, name)
    `)
    .eq('agent_id', agent.id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(10);

  return successResponse({
    agent,
    recent_posts: posts || [],
  });
}
