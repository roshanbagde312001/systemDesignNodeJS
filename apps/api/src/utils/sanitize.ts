import sanitizeHtml from 'sanitize-html';

/** Removes all HTML from plain-text fields (titles, summaries, names). */
export const stripHtml = (s: string) => sanitizeHtml(s, { allowedTags: [], allowedAttributes: {} }).trim();

/**
 * Strips HTML from the given plain-text keys of an object.
 * Markdown bodies are intentionally NOT modified here: code samples legitimately contain "<" and ">",
 * and the frontend renders Markdown without raw HTML and through rehype-sanitize.
 */
export function sanitizeFields<T extends Record<string, unknown>>(obj: T, keys: (keyof T)[]): T {
  const out = { ...obj };
  for (const k of keys) {
    const v = out[k];
    if (typeof v === 'string') out[k] = stripHtml(v) as T[keyof T];
  }
  return out;
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
