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



// Dienstkaarten: vier met link eerst, twee zonder link onderaan.
const dienstenHtml = home.match(/<div class="service-grid">([\s\S]*?)<\/div>\s*<\/section>/)?.[1];
assert.ok(dienstenHtml, 'Dienstenblok ontbreekt');
const dienstenKaarten = [...dienstenHtml.matchAll(/<article class="service-card">([\s\S]*?)<\/article>/g)].map(x => x[1]);
assert.equal(dienstenKaarten.length, 6);
assert.deepEqual(dienstenKaarten.map(x => Number(x.match(/data-site="service(\d)Title"/)?.[1])), [1,3,4,5,2,6]);
assert.ok(dienstenKaarten.slice(0,4).every(x => x.includes('class="service-detail-link"')));
assert.ok(dienstenKaarten.slice(4).every(x => !x.includes('class="service-detail-link"')));
assert.equal(dienstenKaarten.filter(x => x.includes('class="service-detail-link"')).length, 4);
// Btw-vermelding hoort zichtbaar bij de bedrijfsgegevens in de footer.
const footerHtml = home.split('<footer class="site-footer">')[1]?.split('</footer>')[0] || '';
assert.match(footerHtml, /kleineondernemersregeling \(KOR\)/);
assert.match(footerHtml, /geen btw in rekening gebracht/);
assert.equal((home.match(/kleineondernemersregeling \(KOR\)/g) || []).length, 1);


// Instagram contactlink: zichtbare gebruikersnaam met icoon; app/web-overname via HTTPS.
const contact = home.split('<section class="section" id="contact"')[1]?.split('</section>')[0] || '';
assert.match(contact, /href="https:\/\/www\.instagram\.com\/jkworksdordrecht\/"/);
assert.match(contact, /<span>@jkworksdordrecht<\/span>/);
assert.match(contact, /<svg aria-hidden="true"/);
assert.match(contact, /aria-label="Instagram-profiel van JK Works Dordrecht openen"/);
assert.ok(!contact.includes('instagram://'), 'Geen app-only URL zonder webfallback');
assert.ok(!contact.includes('target="_blank"'), 'Universele link gebruikt normale navigatie');
const localBusiness = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || '{}');
assert.deepEqual(localBusiness.sameAs, ['https://www.instagram.com/jkworksdordrecht/']);

console.log('PASS: SEO-pagina\'s, unieke metadata, interne links, schema, sitemap en robots');
