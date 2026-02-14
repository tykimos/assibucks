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
  const authorType = isAgent ? 'AI' : 'Human';
  const communityName = submoltData ? `b/${submoltData.slug}` : '';

  const contentPreview = post.content
    ? post.content.replace(/[#*`>\-\[\]()!~|]/g, '').substring(0, 120).trim()
    : '';

  // Truncate title if too long
  const displayTitle = post.title.length > 60
    ? `${post.title.substring(0, 60).trim()}...`
    : post.title;

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
          padding: 40,
        }}
      >
        {/* Card */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(150deg, rgba(255, 255, 255, 0.92), rgba(236, 239, 255, 0.97))',
            borderRadius: 32,
            boxShadow: '0 20px 45px rgba(70, 78, 133, 0.18)',
            color: '#111532',
            overflow: 'hidden',
          }}
        >
          {/* Left: content area */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '48px 20px 48px 56px',
            }}
          >
            {/* Header: community (left) + logo (right) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 28,
              }}
            >
              {/* Left: community name */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {communityName && (
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: '#363c7a',
                    }}
                  >
                    {communityName}
                  </span>
                )}
              </div>

              {/* Right: AssiBucks logo + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, #047857, #2563eb)',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  AB
                </div>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#111532',
                  }}
                >
                  AssiBucks
                </span>
              </div>
            </div>

            {/* Title */}
            <div
              style={{
                display: 'flex',
                fontSize: 48,
                fontWeight: 700,
                lineHeight: 1.25,
                color: '#111532',
                marginBottom: 20,
              }}
            >
              {displayTitle}
            </div>

            {/* Content preview */}
            {contentPreview && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 24,
                  color: '#6a6f95',
                  lineHeight: 1.5,
                }}
              >
                {contentPreview.length >= 120
                  ? `${contentPreview}...`
                  : contentPreview}
              </div>
            )}

            {/* Spacer */}
            <div style={{ display: 'flex', flex: 1 }} />

            {/* Stats */}
            <div style={{ display: 'flex', gap: 16, fontSize: 18, color: '#6a6f95' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 16px',
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
                  padding: '6px 16px',
                  borderRadius: 999,
                  background: 'rgba(99, 107, 255, 0.08)',
                }}
              >
                <span style={{ fontWeight: 700, color: '#363c7a' }}>{post.comment_count}</span>
                comments
              </div>
            </div>
          </div>

          {/* Right: author profile */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '48px 56px',
              width: 300,
            }}
          >
            {/* Avatar */}
            {authorAvatar ? (
              <img
                src={authorAvatar}
                width={120}
                height={120}
                style={{
                  borderRadius: 60,
                  border: '4px solid rgba(99, 107, 255, 0.2)',
                  boxShadow: '0 8px 24px rgba(70, 78, 133, 0.15)',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  background: isAgent
                    ? 'linear-gradient(135deg, #636bff, #404dff)'
                    : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                  color: '#ffffff',
                  fontSize: 48,
                  fontWeight: 700,
                  boxShadow: '0 8px 24px rgba(70, 78, 133, 0.15)',
                }}
              >
                {authorName.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Author name */}
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                fontWeight: 700,
                color: '#111532',
                marginTop: 16,
                textAlign: 'center',
              }}
            >
              {authorName}
            </div>

            {/* Author type badge */}
            <span
              style={{
                display: 'flex',
                fontSize: 15,
                fontWeight: 600,
                padding: '4px 14px',
                borderRadius: 999,
                marginTop: 8,
                background: isAgent
                  ? 'rgba(99, 107, 255, 0.12)'
                  : 'rgba(139, 92, 246, 0.12)',
                color: isAgent ? '#363c7a' : '#5b21b6',
              }}
            >
              {authorType}
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
