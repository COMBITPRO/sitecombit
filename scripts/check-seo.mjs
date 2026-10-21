import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const site = JSON.parse(fs.readFileSync('src/content/site.json', 'utf8'));
const models = site.equipment.groups.flatMap((group) => group.models);
const builtHtml = fs.readFileSync('dist/index.html', 'utf8');
const stylesheetPath = builtHtml.match(/href="([^" ]*\/_astro\/[^" ]+\.css)"/)?.[1];
assert(stylesheetPath, 'Built stylesheet must be present');
const basePath = stylesheetPath.slice(0, stylesheetPath.indexOf('/_astro/')) + '/';
if (process.env.SITE_BASE_PATH) assert.equal(basePath, `${process.env.SITE_BASE_PATH.replace(/\/$/, '')}/`);
const checkAsset = (asset) => {
  const url = new URL(asset, 'https://build-check.invalid');
  assert(url.pathname.startsWith(basePath), `Resource escapes hosting base ${basePath}: ${asset}`);
  const localPath = decodeURIComponent(url.pathname.slice(basePath.length));
  assert(fs.existsSync(path.join('dist', localPath)), `Missing file: ${asset}`);
};
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
  for (const match of html.matchAll(/(?:href|src)="(\/(?!\/)[^"\s]*)"/g)) checkAsset(match[1]);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert(html.includes(`id="${match[1]}"`), `Broken anchor: ${match[1]}`);
  const decodedHtml = html.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&');
  for (const match of decodedHtml.matchAll(/url\(['"]?(\/(?!\/)[^)'"\s]+)/g)) checkAsset(match[1]);
}
const builtCss = fs.readFileSync(path.join('dist', stylesheetPath.slice(basePath.length)), 'utf8');
for (const match of builtCss.matchAll(/url\(['"]?(\/(?!\/)[^)'"\s]+)/g)) checkAsset(match[1]);
assert(fs.existsSync('dist/.nojekyll'), 'Pages must preserve _astro assets');
const robots = fs.readFileSync('dist/robots.txt', 'utf8');
assert(robots.includes('Allow: /'));
if (fs.existsSync('dist/sitemap.xml')) {
  const sitemap = fs.readFileSync('dist/sitemap.xml', 'utf8');
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.equal(locations.length, routes.length, 'Sitemap must list all pages');
  const home = locations[0];
  assert(home.endsWith('/'));
  if (process.env.SITE_URL) assert.equal(home, `${process.env.SITE_URL.replace(/\/+$/, '')}/`);
  assert(robots.includes(`Sitemap: ${new URL('sitemap.xml', home).href}`));
  for (const [route, html] of pages) {
    const url = home;
    assert(locations.includes(url), `Missing sitemap entry: ${route}`);
    assert(html.includes(`rel="canonical" href="${url}"`), `Incorrect canonical: ${route}`);
    const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(jsonLd['@graph'].find((item) => item['@type'] === 'WebPage')?.url, url);
    const catalog = jsonLd['@graph'].find((item) => item['@type'] === 'ItemList');
    for (const [index, model] of models.entries()) assert.equal(catalog.itemListElement[index].item.image, new URL(model.image.slice(1), home).href);
  }
} else {
  for (const html of pages.values()) assert(!html.includes('rel="canonical"'), 'Unconfigured site must not invent a canonical');
}
console.log(`SEO checks passed: ${routes.length} pages, unique metadata, structured data, internal links and assets${fs.existsSync('dist/sitemap.xml') ? ', canonical URLs and sitemap' : ' (SITE_URL not configured)'}.`);
