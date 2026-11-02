import type { Element, Root, Text } from 'hast';

/**
 * Turns GitHub-style callouts into tagged blockquotes:
 *   > [!TIP]
 *   > Text…
 * becomes <blockquote data-callout="tip">Text…</blockquote>.
 * Runs after sanitization, so it only ever adds a known attribute.
 */
export function rehypeCallouts() {
  return (tree: Root) => {
    const visit = (node: Root | Element) => {
      for (const child of node.children) {
        if (child.type !== 'element') continue;
        if (child.tagName === 'blockquote') tag(child);
        visit(child);
      }
    };
    visit(tree);
  };
}

function tag(blockquote: Element) {
  const firstP = blockquote.children.find((c): c is Element => c.type === 'element' && c.tagName === 'p');
  const firstText = firstP?.children[0] as Text | undefined;
  if (!firstText || firstText.type !== 'text') return;
  const match = firstText.value.match(/^\[!(NOTE|TIP|WARNING|ASSUMPTION|IMPORTANT)\]\s*/i);
  if (!match) return;
  firstText.value = firstText.value.slice(match[0].length);
  blockquote.properties = { ...blockquote.properties, dataCallout: match[1].toLowerCase() };
}
