// Statische SEO-regressie: geen netwerk, geen productiedata.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const routes = ['horeca-catering', 'kleine-klussen', 'montage', 'verbouwing-ondersteuning'];
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
assert.ok(home.includes('site-copy-compat.js'));
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


const legacyRoute = read('montage-kitwerk/index.html');
assert.match(legacyRoute, /content="0;url=https:\/\/jkworks\.nl\/montage\//);
assert.match(legacyRoute, /name="robots" content="noindex,follow"/);
assert.ok(!sitemap.includes('montage-kitwerk/'));
assert.ok(home.includes('href="/montage/"'));
assert.doesNotMatch(home, /kitwerk|kitten|Kit-\s*&|kit- en/i);
assert.ok(!home.includes('<option>Kit- / afwerkwerk</option>'));
assert.ok(home.includes('<option>Meubelmontage</option>'));
for (const route of routes) {
  const page = read(route + '/index.html');
  assert.doesNotMatch(page, /kitwerk|kitten|kit- en/i);
}
assert.equal(compatCtx.window.JKCopyCompat.isLegacy('service4Title', 'Kit- & afwerkwerk'), true);
assert.equal(compatCtx.window.JKCopyCompat.isLegacy('service4Text', 'Plinten, naden en aansluitingen netjes afwerken in woningen, kantoren en andere werkruimtes, passend bij de opdracht en ondergrond.'), true);
assert.equal(compatCtx.window.JKCopyCompat.isLegacy('service4Title', 'Mijn eigen monteertekst'), false);

// Op de homepage één duidelijke doelgroepboodschap; overige secties hebben een eigen functie.
const mainOnly = home.split('<main>')[1]?.split('</main>')[0] || '';
assert.equal((mainOnly.match(/\bbedrijven\b/gi) || []).length, 1, 'Bedrijven niet op elke sectie herhalen');
assert.equal((mainOnly.match(/\bparticulieren\b/gi) || []).length, 1, 'Particulieren niet op elke sectie herhalen');
assert.match(mainOnly, /Waarmee kan ik helpen\?/);
assert.match(mainOnly, /Wie zit er achter JK Works\?/);
assert.match(mainOnly, /Liever direct contact\?/);
assert.match(mainOnly, /Omschrijf je opdracht/);
assert.equal(compatCtx.window.JKCopyCompat.isLegacy(
  'servicesTitle', 'Voor bedrijven én particulieren'), true);
assert.equal(compatCtx.window.JKCopyCompat.isLegacy(
  'heroCopy', 'JK Works helpt bedrijven én particulieren in Dordrecht en omgeving. Van extra mankracht bij horeca, catering en evenementen tot meubelmontage, kleine klussen en praktische hulp in woningen en bedrijfsruimtes. Vooral beschikbaar in de avonduren, weekenden en schoolvakanties.'), true);
assert.equal(compatCtx.window.JKCopyCompat.isLegacy(
  'contactTitle', 'Zelf aangepaste contacttekst'), false);


console.log('PASS: SEO-pagina\'s, unieke metadata, interne links, schema, sitemap en robots');
