import type { ComponentDetails, DesignSection, DesignSectionId, DiagramEdge, DiagramNode, NodeKind } from '@sda/shared';
import { DESIGN_SECTIONS } from '@sda/shared';

/** Grid helper: column/row → pixel position so diagrams stay tidy and easy to edit. */
export const at = (col: number, row: number) => ({ x: col * 230, y: row * 130 });

export function node(
  id: string,
  kind: NodeKind,
  label: string,
  description: string,
  simple: string,
  position: { x: number; y: number },
  details: ComponentDetails,
): DiagramNode {
  return { id, kind, label, description, simple, position, details };
}

export function edge(source: string, target: string, label?: string, async = false): DiagramEdge {
  return { id: `${source}->${target}`, source, target, label, async };
}

/** Builds the ordered section list and fails loudly if a design forgets one of the 22 sections. */
export function sections(content: Record<DesignSectionId, { simple: string; body: string }>): DesignSection[] {
  return DESIGN_SECTIONS.map(({ id, title }) => {
    const c = content[id];
    if (!c) throw new Error(`Missing design section: ${id}`);
    return { id, title, simple: c.simple.trim(), body: c.body.trim() };
  });
}

/** Strips the common leading indentation from template literals. */
export function md(strings: TemplateStringsArray, ...values: unknown[]): string {
  const raw = strings.reduce((acc, s, i) => acc + s + (i < values.length ? String(values[i]) : ''), '');
  const lines = raw.replace(/^\n/, '').split('\n');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(indent)).join('\n').trim();
}
