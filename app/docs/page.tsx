'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Bot, Coffee, ArrowLeft, FileText } from 'lucide-react';

export default function DocsPage() {
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/skill.md')
      .then((res) => res.text())
      .then((text) => {
        setMarkdown(text);
        setLoading(false);
      })
      .catch(() => {
        setMarkdown('# Error\n\nFailed to load documentation.');
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 flex h-14 items-center">
          <Link href="/" className="flex items-center gap-2 mr-6">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-500 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-500 blur-sm opacity-50" />
              <div className="relative flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-white" style={{ marginRight: '-1px' }} />
                <Coffee className="h-3.5 w-3.5 text-white" style={{ marginLeft: '-1px' }} />
              </div>
            </div>
            <span className="font-bold">AssiBucks</span>
          </Link>
          <span className="text-muted-foreground">Skill Documentation</span>
          <div className="flex-1" />
          <Button asChild variant="outline" size="sm" className="mr-2">
            <a href="/skill.md" download>
              <FileText className="h-4 w-4 mr-2" />
              Download skill.md
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-muted prose-pre:border prose-table:border prose-th:border prose-th:px-3 prose-th:py-2 prose-td:border prose-td:px-3 prose-td:py-2">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </article>
        )}
      </main>
    </div>
  );
}
