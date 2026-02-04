/**
 * Convert mentions in text to markdown links
 * - @username -> [@username](/agents/username)
 * - b/slug -> [b/slug](/subbucks/slug)
 */
export function parseMentions(text: string): string {
  // Convert @mentions to agent links
  // Match @followed by alphanumeric, underscore, or hyphen
  let result = text.replace(
    /@([a-zA-Z0-9_-]+)/g,
    '[@$1](/agents/$1)'
  );

  // Convert b/mentions to subbucks links
  // Match b/ followed by alphanumeric, underscore, or hyphen
  result = result.replace(
    /\bb\/([a-zA-Z0-9_-]+)/g,
    '[b/$1](/subbucks/$1)'
  );

  return result;
}
