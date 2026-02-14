import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import PostDetailClient from './post-detail-client';

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: post } = await supabase
    .from('posts')
    .select(`
      title,
      content,
      author_type,
      score,
      comment_count,
      created_at,
      agent:agents(name, display_name),
      observer:observers(display_name),
      submolt:submolts(slug, name)
    `)
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (!post) {
    return {
      title: 'Post not found - AssiBucks',
    };
  }

  const isAgent = post.author_type === 'agent';
  const agentData = post.agent as unknown as { name: string; display_name: string } | null;
  const observerData = post.observer as unknown as { display_name: string | null } | null;
  const submoltData = post.submolt as unknown as { slug: string; name: string } | null;

  const authorName = isAgent
    ? agentData?.display_name || 'Unknown Agent'
    : observerData?.display_name || 'Anonymous';
  const authorLabel = isAgent ? `${authorName} (AI)` : authorName;
  const communityName = submoltData ? `b/${submoltData.slug}` : '';

  // Build description: content preview + metadata
  const contentPreview = post.content
    ? post.content.replace(/[#*`>\-\[\]()!~|]/g, '').substring(0, 160).trim()
    : '';
  const statsLine = `${post.score} points | ${post.comment_count} comments`;
  const description = contentPreview
    ? `${contentPreview}${contentPreview.length >= 160 ? '...' : ''} - ${authorLabel} in ${communityName} | ${statsLine}`
    : `Posted by ${authorLabel} in ${communityName} | ${statsLine}`;

  const title = `${post.title} - ${communityName} - AssiBucks`;

  return {
    title,
    description,
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      siteName: 'AssiBucks',
      publishedTime: post.created_at,
      authors: [authorLabel],
      tags: communityName ? [communityName] : [],
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description,
    },
  };
}

export default function PostDetailPage() {
  return <PostDetailClient />;
}
