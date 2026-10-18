// Statische SEO-regressie: geen netwerk, geen productiedata.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const routes = ['horeca-catering', 'kleine-klussen', 'montage-kitwerk', 'verbouwing-ondersteuning'];
const home = read('index.html');
const robots = read('robots.txt');
const sitemap = read('sitemap.xml');
assert.match(robots, /Disallow:\s*\/app\//);
assert.match(robots, /Disallow:\s*\/inloggen\//);
assert.match(robots, /Sitemap:\s*https:\/\/jkworks\.nl\/sitemap\.xml/);
assert.match(home, /rel="canonical" href="https:\/\/jkworks\.nl\/"/);
assert.match(sitemap, /<loc>https:\/\/jkworks\.nl\/<\/loc>/);
const titles = new Set();
const descriptions = new Set();
for (const route of routes) {
  const html = read(route + '/index.html');
  const url = 'https://jkworks.nl/' + route + '/';
  assert.ok(sitemap.includes('<loc>' + url + '</loc>'), 'Sitemap URL ontbreekt: ' + url);
  assert.ok(home.includes('href="/' + route + '/"'), 'Link op homepage ontbreekt: ' + route);
  assert.ok(html.includes('rel="canonical" href="' + url + '"'), 'Canonical ontbreekt: ' + route);
  assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large">/);
  assert.equal((html.match(/<h1>/g) || []).length, 1, 'Precies één H1: ' + route);
  assert.match(html, /href="\/#aanvragen"/, 'Aanvraaglink ontbreekt: ' + route);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(title?.includes('JK Works'), 'Titel ontbreekt');
  assert.ok(description?.includes('Dordrecht'), 'Lokale omschrijving ontbreekt');
  assert.ok(!titles.has(title), 'Duplicaat title: ' + route);
  assert.ok(!descriptions.has(description), 'Duplicaat description: ' + route);
  titles.add(title); descriptions.add(description);
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  const schema = JSON.parse(json || '{}');
  assert.ok(schema['@graph']?.some(x => x['@type'] === 'Service' && x.url === url));
  assert.ok(schema['@graph']?.some(x => x['@type'] === 'BreadcrumbList'));
  assert.ok(html.includes('href="/"') && html.includes('href="/#contact"'));
}
assert.equal((sitemap.match(/<loc>/g) || []).length, 5, 'Alleen openbare pagina\'s in sitemap');

// Klantgroepen: homepage en diensten expliciet voor particulieren en bedrijven.
assert.match(home, /particulieren/);
assert.match(home, /bedrijven/);
assert.match(home, /site-copy-compat\\.js/);
const vm = require('node:vm');
const compatCtx = { window: {} };
vm.runInNewContext(read('site-copy-compat.js'), compatCtx);
assert.equal(compatCtx.window.JKCopyCompat.isLegacy('heroTitle1', 'Flexibele ondersteuning waar'), true);
assert.equal(compatCtx.window.JKCopyCompat.isLegacy('heroTitle1', 'Mijn eigen webeditortekst'), false);
for (const route of routes) {
  const page = read(route + '/index.html');
  assert.match(page, /bedrijven|bedrijfsruimte/);
  assert.match(page, /particulieren|particuliere/);
}

console.log('PASS: SEO-pagina\'s, unieke metadata, interne links, schema, sitemap en robots');
