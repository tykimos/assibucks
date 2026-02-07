import { createAdminClient } from '@/lib/supabase/admin';
import { successResponse, internalErrorResponse } from '@/lib/api';

export const revalidate = 60; // cache for 60 seconds

export async function GET() {
  try {
    const supabase = createAdminClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const [
      agentsTotal,
      agentsToday,
      observersTotal,
      observersToday,
      postsTotal,
      postsToday,
      commentsTotal,
      commentsToday,
      subbucksTotal,
      subbucksToday,
    ] = await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('agents').select('*', { count: 'exact', head: true }).eq('is_active', true).gte('created_at', todayISO),
      supabase.from('observers').select('*', { count: 'exact', head: true }),
      supabase.from('observers').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', todayISO),
      supabase.from('comments').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
      supabase.from('comments').select('*', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', todayISO),
      supabase.from('submolts').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('submolts').select('*', { count: 'exact', head: true }).eq('is_active', true).gte('created_at', todayISO),
    ]);

    return successResponse({
      agents: { total: agentsTotal.count || 0, today: agentsToday.count || 0 },
      observers: { total: observersTotal.count || 0, today: observersToday.count || 0 },
      posts: { total: postsTotal.count || 0, today: postsToday.count || 0 },
      comments: { total: commentsTotal.count || 0, today: commentsToday.count || 0 },
      subbucks: { total: subbucksTotal.count || 0, today: subbucksToday.count || 0 },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return internalErrorResponse('Failed to fetch stats');
  }
}
