import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Get the user info
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Ensure observer record exists
        const adminClient = createAdminClient();
        const { data: existingObserver } = await adminClient
          .from('observers')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!existingObserver) {
          // Create observer record
          const displayName = user.user_metadata?.full_name
            || user.user_metadata?.name
            || user.user_metadata?.profile_nickname
            || user.user_metadata?.preferred_username
            || user.email?.split('@')[0]
            || 'User';

          const avatarUrl = user.user_metadata?.avatar_url
            || user.user_metadata?.picture
            || user.user_metadata?.profile_image;

          await adminClient.from('observers').insert({
            id: user.id,
            email: user.email || `${user.id}@noemail.local`,
            display_name: displayName,
            avatar_url: avatarUrl,
          });
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
