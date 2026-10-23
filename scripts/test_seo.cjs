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


// Website-editor gebruikt de actuele homepage als tekstbron; oude opgeslagen
// standaardwaarden mogen geen vorige diensten of koppen terugbrengen.
const previewSource = read('site-editor-public.js');
const editorSource = read('app/website-editor.js');
const editorAppHtml = read('app/index.html');
const editorWorker = read('app/service-worker.js');
const editorCtx = { window: {} };
vm.runInNewContext(editorSource, editorCtx);
const normalizeWebsiteContent = editorCtx.window.JKWebsiteEditor?.normalizeContent;
assert.equal(typeof normalizeWebsiteContent, 'function');
const htmlDefaults = {
  heroTitle1: 'Praktische hulp voor bedrijven',
  servicesTitle: 'Waarmee kan ik helpen?',
  service4Title: 'Meubels & montage',
  contactTitle: 'Liever direct contact?'
};
const stored = {
  heroTitle1: 'Flexibele ondersteuning waar',
  servicesTitle: 'Waarmee kan ik helpen?',
  service4Title: 'Kit- & afwerkwerk',
  contactTitle: 'Mijn eigen contacttekst',
  sectionVisibility: { contact: false },
  sectionOrder: ['hero', 'diensten', 'contact'],
  siteImages: { hero: 'https://example.org/mijn-foto.jpg' }
};
const normalizedWebsite = normalizeWebsiteContent(stored, htmlDefaults,
  (key, value) => compatCtx.window.JKCopyCompat.isLegacy(key, value));
assert.equal(Object.hasOwn(normalizedWebsite, 'heroTitle1'), false);
assert.equal(Object.hasOwn(normalizedWebsite, 'servicesTitle'), false);
assert.equal(Object.hasOwn(normalizedWebsite, 'service4Title'), false);
assert.equal(normalizedWebsite.contactTitle, 'Mijn eigen contacttekst');
assert.equal(normalizedWebsite.sectionVisibility.contact, false);
assert.equal(normalizedWebsite.sectionOrder[0], 'hero');
assert.equal(normalizedWebsite.siteImages.hero, 'https://example.org/mijn-foto.jpg');
assert.equal(stored.heroTitle1, 'Flexibele ondersteuning waar');
assert.equal(Object.hasOwn(normalizeWebsiteContent(
  { heroTitle1: htmlDefaults.heroTitle1 }, htmlDefaults, () => false), 'heroTitle1'), false);
assert.match(previewSource, /defaults:Object\.fromEntries\(defaults\)/);
assert.match(previewSource, /if\(editorMode\)window\.parent\.postMessage/);
assert.match(previewSource, /else load\(\)/);
assert.match(read('site.js'), /if\(!\(new URLSearchParams\(location\.search\)\.has\('jkedit'\)/);
assert.match(home, /site\.js\?v=71\.8\.8/);

assert.match(editorSource, /siteDefaults=msg\.defaults/);
assert.match(editorSource, /const val=content\[sel\.key\]\?\?siteDefaults\[sel\.key\]/);
assert.match(editorAppHtml, /website-editor\.js\?v=71\.8\.9/);
assert.match(home, /site-editor-public\.js\?v=71\.8\.8/);
assert.match(editorWorker, /jkworks-pricing-v71-13-22/);


// Alleen de geïnstalleerde webapp krijgt extra ruimte rond de iOS-statusbalk.
const appStyles=read('app/styles.css');
const mobileEditor=read('app/website-editor.js');
const appHtml=read('app/index.html');
const pwaWorker=read('app/service-worker.js');
assert.match(mobileEditor, /matchMedia\?\.\('\(display-mode: standalone\)'\)/);
assert.match(mobileEditor, /navigator\.standalone===true/);
assert.match(mobileEditor, /we-pwa-safe-area/);
assert.match(appStyles, /\.website-editor-overlay\.we-pwa-safe-area\s*\{/);
assert.match(appStyles, /padding-top:env\(safe-area-inset-top,0px\)/);
assert.match(appStyles, /\.we-v714\.we-pwa-safe-area \.we-shell\{height:100%;min-height:0\}/);
assert.doesNotMatch(read('site.css'), /we-pwa-safe-area/);
assert.match(appHtml, /styles\.css\?v=71\.13\.22/);
assert.match(appStyles,/iOS Safari zoomt naar tekstvelden/);
assert.match(appStyles,/font-size:16px !important/);
assert.doesNotMatch(appHtml,/user-scalable=no|maximum-scale=1/);
assert.match(appHtml,/job-label\.js\?v=71\.13\.22/);
assert.match(appHtml,/job-label-editor\.js\?v=71\.13\.22/);
assert.match(pwaWorker,/job-label\.js/);
assert.match(pwaWorker,/job-label-editor\.js/);
assert.match(appHtml, /website-editor\.js\?v=71\.8\.9/);
assert.match(pwaWorker, /jkworks-pricing-v71-13-22/);


// Actieuitstel en direct offerteverzoek, onafhankelijk van browser-cache.
const appSource=read('app/app.js');
const pushSource=read('app/push.js');
const edgeSource=read('supabase/functions/jk-push/index.ts');
assert.match(appSource,/SNOOZE_OPTIONS=\[\['1h','1 uur'\],\['12h','12 uur'\],\['7d','7 dagen'\],\['14d','14 dagen'\],\['1m','1 maand'\]\]/);
assert.match(appSource,/data-snooze-index/);
assert.match(appSource,/async function collectActionItems\(\{includeSnoozed=false,knownSnoozes=null\}=\{\}\)/);
assert.match(appSource,/function snoozedActionDescription\(key\)/);
assert.match(appSource,/const describeJob=job=>/);
assert.match(appSource,/esc\(snoozedActionDescription\(key\)\.title\)/);
assert.doesNotMatch(appSource,/esc\(key\.split\(':'\)\[0\]\)/);
assert.match(appSource,/getActionSnoozes\(\)/);
assert.match(appSource,/Date\.parse\(snoozes\[i\.key\]\)>Date\.now\(\)/);
assert.match(appSource,/await JKDB\.putLocal\('settings',record\)/);
assert.match(appSource,/if\(prefs\.quoteCreate&&j\.quoteNeeded&&!quotes\.length\)add/);
assert.doesNotMatch(appSource,/j\.quoteNeeded&&!quotes\.length&&!ended/);
assert.match(appSource,/const actions=await refreshActionBadges\(true\)/);
assert.match(pushSource,/async function snooze\(key,duration\)/);
assert.match(pushSource,/async function unsnooze\(key\)/);
assert.match(pushSource,/async function snoozes\(\)/);
assert.match(pushSource,/async function quoteNeeded\(jobId\)/);
assert.match(edgeSource,/jk_push_action_snoozes/);
assert.match(edgeSource,/runActionChecks\(\)/);
assert.match(edgeSource,/notificationSnapshot/);
assert.match(read('app/cloud.js'),/publishNotificationProjection/);
assert.match(read('app/cloud.js'),/notificationProjection/);
assert.match(appSource,/hasPushSubscription/);
assert.match(edgeSource,/newActions=initialized\?active\.filter/);
assert.match(edgeSource,/body\?\.action==='quote-needed'/);
assert.match(edgeSource,/await notifyQuoteNeeded\(user\.id,body\.jobId\)/);
assert.match(edgeSource,/if\(j\.quoteNeeded&&!quotes\.length\)add/);
assert.match(edgeSource,/duration==='1m'/);
assert.match(read('app/index.html'),/push\.js\?v=71\.13\.22/);
assert.match(read('app/index.html'),/app\.js\?v=71\.13\.22/);
assert.match(read('app/styles.css'),/\.action-snooze\{/);
assert.match(read('app/service-worker.js'),/jkworks-pricing-v71-13-22/);
assert.match(read('supabase/migrations/20261018_action_snoozes.sql'),/enable row level security/);

console.log('PASS: SEO-pagina\'s, unieke metadata, interne links, schema, sitemap en robots');
