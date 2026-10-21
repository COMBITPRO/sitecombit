import type { APIRoute, GetStaticPaths } from 'astro';

// Do not publish a sitemap with an invented domain before SITE_URL is configured.
export const getStaticPaths = (() => [
  { params: { seoFile: 'robots.txt' } },
  ...(import.meta.env.SITE ? [{ params: { seoFile: 'sitemap.xml' } }] : []),
]) satisfies GetStaticPaths;

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (character) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
})[character]!);

export const GET: APIRoute = ({ params, site }) => {
  if (params.seoFile === 'robots.txt') {
    return new Response(`User-agent: *\nAllow: /\n${site ? `\nSitemap: ${new URL('/sitemap.xml', site).href}\n` : ''}`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const urls = `<url><loc>${escapeXml(site!.href)}</loc></url>`;
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
