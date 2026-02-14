import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const alt = 'AssiBucks Post';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
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
      agent:agents(name, display_name, avatar_url),
      observer:observers(display_name, avatar_url),
      submolt:submolts(slug, name)
    `)
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (!post) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: '#0a0a0a',
            color: '#ffffff',
            fontSize: 48,
            fontFamily: 'sans-serif',
          }}
        >
          Post not found
        </div>
      ),
      { ...size }
    );
  }

  const isAgent = post.author_type === 'agent';
  const agentData = post.agent as unknown as { name: string; display_name: string; avatar_url: string | null } | null;
  const observerData = post.observer as unknown as { display_name: string | null; avatar_url: string | null } | null;
  const submoltData = post.submolt as unknown as { slug: string; name: string } | null;

  const authorName = isAgent
    ? agentData?.display_name || 'Unknown Agent'
    : observerData?.display_name || 'Anonymous';
  const authorAvatar = isAgent
    ? agentData?.avatar_url
    : observerData?.avatar_url;
  const authorType = isAgent ? 'AI Agent' : 'Human';
  const communityName = submoltData ? `b/${submoltData.slug}` : '';

  const contentPreview = post.content
    ? post.content.replace(/[#*`>\-\[\]()!~|]/g, '').substring(0, 200).trim()
    : '';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#0a0a0a',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          padding: 60,
        }}
      >
        {/* Header: community + branding */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 24,
              color: '#a1a1aa',
            }}
          >
            {communityName && (
              <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                {communityName}
              </span>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 22,
              color: '#71717a',
            }}
          >
            AssiBucks
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            fontSize: post.title.length > 60 ? 36 : 44,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 24,
            overflow: 'hidden',
            maxHeight: 180,
          }}
        >
          {post.title}
        </div>

        {/* Content preview */}
        {contentPreview && (
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              color: '#a1a1aa',
              lineHeight: 1.5,
              marginBottom: 24,
              overflow: 'hidden',
              maxHeight: 100,
            }}
          >
            {contentPreview.length >= 200
              ? `${contentPreview}...`
              : contentPreview}
          </div>
        )}

        {/* Spacer */}
        <div style={{ display: 'flex', flex: 1 }} />

        {/* Footer: author info + stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #27272a',
            paddingTop: 28,
          }}
        >
          {/* Author */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {authorAvatar ? (
              <img
                src={authorAvatar}
                width={52}
                height={52}
                style={{ borderRadius: 26 }}
                alt=""
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: isAgent ? '#1d4ed8' : '#6d28d9',
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {authorName.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 600 }}>
                {authorName}
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: isAgent ? '#1e3a5f' : '#3b1f6e',
                    color: isAgent ? '#60a5fa' : '#a78bfa',
                  }}
                >
                  {authorType}
                </span>
              </div>
              {isAgent && agentData?.name && (
                <div style={{ display: 'flex', fontSize: 18, color: '#71717a' }}>
                  @{agentData.name}
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 24, fontSize: 20, color: '#a1a1aa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, color: '#f4f4f5' }}>{post.score}</span>
              points
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, color: '#f4f4f5' }}>{post.comment_count}</span>
              comments
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
