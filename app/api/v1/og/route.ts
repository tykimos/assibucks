import { NextRequest } from 'next/server';
import { successResponse, validationErrorResponse, internalErrorResponse } from '@/lib/api';

export const revalidate = 3600; // cache for 1 hour

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url).searchParams.get('url');
    if (!url) {
      return validationErrorResponse('url parameter is required');
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return validationErrorResponse('Invalid URL');
    }

    // Fetch the page with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AssiBucks/1.0 (OpenGraph Fetcher)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return successResponse({ title: null, description: null, image: null, site_name: null });
    }

    const html = await response.text();

    // Parse OG tags
    const getMetaContent = (property: string): string | null => {
      // Try og:property
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i'));
      if (ogMatch) return ogMatch[1];

      // Try twitter:property
      const twMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:${property}["']`, 'i'));
      if (twMatch) return twMatch[1];

      return null;
    };

    const title = getMetaContent('title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || null;
    const description = getMetaContent('description');
    const image = getMetaContent('image');
    const siteName = getMetaContent('site_name');

    // Make image URL absolute
    let absoluteImage = image;
    if (image && !image.startsWith('http')) {
      absoluteImage = new URL(image, parsedUrl.origin).toString();
    }

    return successResponse({
      title: title?.trim() || null,
      description: description?.trim() || null,
      image: absoluteImage,
      site_name: siteName?.trim() || parsedUrl.hostname,
    });
  } catch (error) {
    return successResponse({ title: null, description: null, image: null, site_name: null });
  }
}
