'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface OGData {
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
}

export function LinkPreview({ url }: { url: string }) {
  const [og, setOg] = useState<OGData | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    async function fetchOG() {
      try {
        const res = await fetch(`/api/v1/og?url=${encodeURIComponent(url)}`);
        const result = await res.json();
        if (result.success && result.data) {
          setOg(result.data);
        }
      } catch {}
    }
    fetchOG();
  }, [url]);

  if (!og || (!og.title && !og.image)) return null;

  let hostname = '';
  try { hostname = new URL(url).hostname; } catch {}

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 border rounded-lg overflow-hidden hover:bg-accent/50 transition-colors"
    >
      {og.image && !imgError && (
        <div className="relative w-full h-48 bg-muted">
          <img
            src={og.image}
            alt={og.title || ''}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <ExternalLink className="h-3 w-3" />
          {og.site_name || hostname}
        </div>
        {og.title && (
          <p className="font-medium text-sm line-clamp-2">{og.title}</p>
        )}
        {og.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{og.description}</p>
        )}
      </div>
    </a>
  );
}
