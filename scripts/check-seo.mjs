import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const site = JSON.parse(fs.readFileSync('src/content/site.json', 'utf8'));
const models = site.equipment.groups.flatMap((group) => group.models);
const routes = ['/'];
const htmlFiles = (folder) => fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? htmlFiles(path.join(folder, entry.name)) : entry.name.endsWith('.html') ? [path.join(folder, entry.name)] : []);
assert.equal(htmlFiles('dist').length, 1, 'The build must remain a single-page landing');
assert.equal(new Set(routes).size, routes.length, 'Page paths must be unique');
const pages = new Map(routes.map((route) => {
  assert(/^\/(?:[a-z0-9-]+\/)*$/.test(route), `Invalid path: ${route}`);
  return [route, fs.readFileSync(path.join('dist', route, 'index.html'), 'utf8')];
}));
const titles = new Set();
const descriptions = new Set();
for (const [route, html] of pages) {
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, `One h1 required: ${route}`);
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert(title && !titles.has(title), `Missing or duplicate title: ${route}`);
  assert(description && !descriptions.has(description), `Missing or duplicate description: ${route}`);
  titles.add(title);
  descriptions.add(description);
  assert(!html.includes('noindex'), `Unexpected indexing restriction: ${route}`);
  const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1] ?? 'null');
  assert.equal(jsonLd?.['@graph']?.[0]?.name, 'Комбит Про', `Organization missing: ${route}`);
  const catalog = jsonLd['@graph'].find((item) => item['@type'] === 'ItemList');
  assert.equal(catalog?.numberOfItems, models.length);
  for (const [index, model] of models.entries()) {
    assert.equal(catalog.itemListElement[index].item.name, model.title);
    assert(html.includes(`id="equipment-model-${model.id}"`));
    if (catalog.itemListElement[index].item.url) assert.equal(new URL(catalog.itemListElement[index].item.url).hash, `#equipment-model-${model.id}`);
  }
  for (const match of html.matchAll(/(?:href|src)="(\/[^"\s]*)"/g)) {
    const url = new URL(match[1], 'https://build-check.invalid');
    const localPath = decodeURIComponent(url.pathname);
    const target = path.join('dist', localPath);
    assert(fs.existsSync(target), `Broken asset or link on ${route}: ${match[1]}`);
    if (url.hash && pages.has(localPath)) {
      assert(pages.get(localPath).includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Broken fragment on ${route}: ${match[1]}`);
    }
  }
}
const robots = fs.readFileSync('dist/robots.txt', 'utf8');
assert(robots.includes('Allow: /'));
if (fs.existsSync('dist/sitemap.xml')) {
  const sitemap = fs.readFileSync('dist/sitemap.xml', 'utf8');
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.equal(locations.length, routes.length, 'Sitemap must list all pages');
  const origin = new URL(locations[0]).origin;
  assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  for (const [route, html] of pages) {
    const url = `${origin}${route}`;
    assert(locations.includes(url), `Missing sitemap entry: ${route}`);
    assert(html.includes(`rel="canonical" href="${url}"`), `Incorrect canonical: ${route}`);
    const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(jsonLd['@graph'].find((item) => item['@type'] === 'WebPage')?.url, url);
  }
} else {
  for (const html of pages.values()) assert(!html.includes('rel="canonical"'), 'Unconfigured site must not invent a canonical');
}
console.log(`SEO checks passed: ${routes.length} pages, unique metadata, structured data, internal links and assets${fs.existsSync('dist/sitemap.xml') ? ', canonical URLs and sitemap' : ' (SITE_URL not configured)'}.`);
