'use client';

import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Link,
  Code,
  Image as ImageIcon,
  Quote,
} from 'lucide-react';

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onImageClick?: () => void;
}

type FormatAction = {
  icon: React.ReactNode;
  label: string;
  action: 'wrap' | 'prefix' | 'block' | 'custom';
  before?: string;
  after?: string;
  placeholder?: string;
};

const FORMAT_ACTIONS: FormatAction[] = [
  { icon: <Bold className="h-3.5 w-3.5" />, label: 'Bold', action: 'wrap', before: '**', after: '**', placeholder: 'bold text' },
  { icon: <Italic className="h-3.5 w-3.5" />, label: 'Italic', action: 'wrap', before: '*', after: '*', placeholder: 'italic text' },
  { icon: <Heading2 className="h-3.5 w-3.5" />, label: 'Heading', action: 'prefix', before: '## ', placeholder: 'Heading' },
  { icon: <Quote className="h-3.5 w-3.5" />, label: 'Quote', action: 'prefix', before: '> ', placeholder: 'quote' },
  { icon: <List className="h-3.5 w-3.5" />, label: 'Bullet List', action: 'prefix', before: '- ', placeholder: 'list item' },
  { icon: <ListOrdered className="h-3.5 w-3.5" />, label: 'Numbered List', action: 'prefix', before: '1. ', placeholder: 'list item' },
  { icon: <Code className="h-3.5 w-3.5" />, label: 'Code', action: 'wrap', before: '`', after: '`', placeholder: 'code' },
  { icon: <Link className="h-3.5 w-3.5" />, label: 'Link', action: 'custom', placeholder: 'url' },
];

export function MarkdownToolbar({ textareaRef, value, onChange, onImageClick }: MarkdownToolbarProps) {
  const applyFormat = (formatAction: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let newValue: string;
    let newCursorStart: number;
    let newCursorEnd: number;

    if (formatAction.action === 'wrap') {
      const before = formatAction.before || '';
      const after = formatAction.after || '';
      const text = selectedText || formatAction.placeholder || '';
      newValue = value.substring(0, start) + before + text + after + value.substring(end);
      if (selectedText) {
        newCursorStart = start + before.length;
        newCursorEnd = start + before.length + text.length;
      } else {
        newCursorStart = start + before.length;
        newCursorEnd = start + before.length + text.length;
      }
    } else if (formatAction.action === 'prefix') {
      const before = formatAction.before || '';
      // Find the start of the current line
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const text = selectedText || formatAction.placeholder || '';
      if (selectedText) {
        newValue = value.substring(0, lineStart) + before + value.substring(lineStart);
        newCursorStart = start + before.length;
        newCursorEnd = end + before.length;
      } else {
        newValue = value.substring(0, start) + (start === lineStart ? '' : '\n') + before + text + value.substring(end);
        const offset = start === lineStart ? 0 : 1;
        newCursorStart = start + offset + before.length;
        newCursorEnd = start + offset + before.length + text.length;
      }
    } else if (formatAction.action === 'custom') {
      // Link
      const text = selectedText || 'link text';
      const linkMd = `[${text}](url)`;
      newValue = value.substring(0, start) + linkMd + value.substring(end);
      // Select "url" part
      newCursorStart = start + text.length + 3; // after "[text]("
      newCursorEnd = newCursorStart + 3; // select "url"
    } else {
      return;
    }

    onChange(newValue);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    });
  };

  return (
    <div className="flex items-center gap-0.5 border-b pb-1.5 mb-1.5">
      {FORMAT_ACTIONS.map((action) => (
        <Button
          key={action.label}
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title={action.label}
          onClick={() => applyFormat(action)}
        >
          {action.icon}
        </Button>
      ))}
      {onImageClick && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Insert Image"
          onClick={onImageClick}
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
