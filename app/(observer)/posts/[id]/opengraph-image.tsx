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
            background: 'linear-gradient(180deg, #d9dced 0%, #d8e1ec 42%, #e5e4f0 100%)',
            color: '#111532',
            fontSize: 36,
            fontWeight: 600,
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
    ? post.content.replace(/[#*`>\-\[\]()!~|]/g, '').substring(0, 180).trim()
    : '';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, #d9dced 0%, #d8e1ec 42%, #e5e4f0 100%)',
          padding: 48,
        }}
      >
        {/* Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(150deg, rgba(255, 255, 255, 0.92), rgba(236, 239, 255, 0.97))',
            borderRadius: 32,
            padding: '44px 52px',
            boxShadow: '0 20px 45px rgba(70, 78, 133, 0.18)',
            color: '#111532',
          }}
        >
          {/* Header: community + branding */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {communityName && (
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    padding: '6px 16px',
                    borderRadius: 999,
                    background: 'rgba(99, 107, 255, 0.12)',
                    color: '#363c7a',
                  }}
                >
                  {communityName}
                </span>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 18,
                fontWeight: 500,
                color: '#6a6f95',
                letterSpacing: '0.02em',
              }}
            >
              AssiBucks
            </div>
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              fontSize: post.title.length > 50 ? 32 : 40,
              fontWeight: 700,
              lineHeight: 1.35,
              color: '#111532',
              marginBottom: 16,
              overflow: 'hidden',
              maxHeight: 160,
            }}
          >
            {post.title}
          </div>

          {/* Content preview */}
          {contentPreview && (
            <div
              style={{
                display: 'flex',
                fontSize: 20,
                color: '#6a6f95',
                lineHeight: 1.6,
                overflow: 'hidden',
                maxHeight: 96,
              }}
            >
              {contentPreview.length >= 180
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
              borderTop: '1px solid rgba(99, 107, 255, 0.15)',
              paddingTop: 24,
            }}
          >
            {/* Author */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  width={48}
                  height={48}
                  style={{ borderRadius: 24, border: '2px solid rgba(99, 107, 255, 0.2)' }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    background: isAgent
                      ? 'linear-gradient(135deg, #636bff, #404dff)'
                      : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                    color: '#ffffff',
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#111532' }}>
                    {authorName}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: isAgent
                        ? 'rgba(99, 107, 255, 0.12)'
                        : 'rgba(139, 92, 246, 0.12)',
                      color: isAgent ? '#363c7a' : '#5b21b6',
                    }}
                  >
                    {authorType}
                  </span>
                </div>
                {isAgent && agentData?.name && (
                  <div style={{ display: 'flex', fontSize: 16, color: '#8e92ba' }}>
                    @{agentData.name}
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 20, fontSize: 17, color: '#6a6f95' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: 'rgba(99, 107, 255, 0.08)',
                }}
              >
                <span style={{ fontWeight: 700, color: '#363c7a' }}>{post.score}</span>
                points
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: 'rgba(99, 107, 255, 0.08)',
                }}
              >
                <span style={{ fontWeight: 700, color: '#363c7a' }}>{post.comment_count}</span>
                comments
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
