/**
 * Generates public/sitemap.xml from the content package at build time.
 * Usage: SITE_URL=https://example.com tsx scripts/generate-sitemap.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { articles, learningPaths, systemDesigns } from '@sda/content';

const site = (process.env.VITE_SITE_URL ?? process.env.SITE_URL ?? 'https://systemdesign.academy').replace(/\/$/, '');
const staticPaths = ['/', '/system-designs', '/concepts', '/patterns', '/playground', '/learning-paths', '/glossary', '/about'];

const urls: { loc: string; lastmod?: string }[] = [
  ...staticPaths.map((p) => ({ loc: p })),
  ...systemDesigns.filter((d) => d.status === 'published').map((d) => ({ loc: `/system-design/${d.slug}`, lastmod: d.publishedAt })),
  ...articles.filter((a) => a.status === 'published').map((a) => ({ loc: `/concepts/${a.slug}`, lastmod: a.updatedAt ?? a.publishedAt })),
  ...learningPaths.filter((p) => p.status === 'published').map((p) => ({ loc: `/learning-paths/${p.slug}` })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${site}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;

const out = fileURLToPath(new URL('../public/sitemap.xml', import.meta.url));
writeFileSync(out, xml);
console.log(`sitemap.xml: ${urls.length} URLs → ${out}`);
