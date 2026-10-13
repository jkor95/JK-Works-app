// Regressie-smoke test: uitsluitend geïsoleerde lokale browserdata en backendfixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

async function files(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(entry.name)) continue;
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(name));
    else result.push(name);
  }
  return result;
}

(async () => {
  const sourceFiles = await files(root);
  for (const file of sourceFiles.filter(f => /\.(js|cjs)$/.test(f))) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  assert.equal((await fs.readFile(path.join(root, 'CNAME'), 'utf8')).trim(), 'jkworks.nl');
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'app/manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, '/app/');
  assert.equal(manifest.scope, '/app/');
  for (const icon of manifest.icons) await fs.access(path.join(root, 'app', icon.src));
  const worker = await fs.readFile(path.join(root, 'app/service-worker.js'), 'utf8');
  const precache = worker.match(/const LOCAL\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(precache, 'Service-worker precache ontbreekt');
  for (const [, asset] of precache[1].matchAll(/'([^']+)'/g)) {
    await fs.access(path.join(root, 'app', asset));
  }
  for (const file of sourceFiles.filter(f => f.endsWith('.pdf'))) {
    assert.equal((await fs.readFile(file)).subarray(0, 5).toString(), '%PDF-', file);
  }
  console.log('PASS: JavaScript-syntax, domein, manifest, precache en PDF-sjablonen');
  await require('./test_invoice_payment.cjs')();
  console.log('PASS: factuur-betaalstatus en gekoppelde klussen (fictieve gegevens)');

  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf' };
  const server = http.createServer(async (req, res) => {
    try {
      let filename = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
      if (filename !== root && !filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      if ((await fs.stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
      res.end(await fs.readFile(filename));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.JK_BROWSER_EXECUTABLE ? { executablePath: process.env.JK_BROWSER_EXECUTABLE } : {}),
      ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {}),
    });
    const context = await browser.newContext();
    const failures = [];
    const mutations = [];
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(error.message));
    page.on('requestfailed', request => failures.push(`${request.url()}: ${request.failure().errorText}`));
    page.on('response', response => { if (response.status() >= 400) failures.push(`${response.url()}: HTTP ${response.status()}`); });
    await context.route('**/*', async route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) {
        mutations.push(`${request.method()} ${new URL(request.url()).hostname}`);
        await route.abort(); return;
      }
      if (new URL(request.url()).hostname.endsWith('.supabase.co')) {
        // Geen productiegegevens nodig; lege openbare inhoud is een expliciete fixture.
        assert.ok(new URL(request.url()).pathname.startsWith('/rest/v1/app_records'), 'Onverwacht Supabase-leesverzoek');
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return;
      }
      if(process.env.HTTPS_PROXY&&new URL(request.url()).protocol==='https:'){
        // The cloud proxy CA is trusted by Node via NODE_EXTRA_CA_CERTS. Keep
        // TLS verification enabled while loading genuine external SDK assets.
        const response=await context.request.get(request.url());
        await route.fulfill({response});return;
      }
      await route.continue();
    });
    for (const route of ['/', '/inloggen/', '/app/']) {
      const response = await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 30000 });
      assert.equal(response.status(), 200);
      assert.ok(await page.evaluate(() => !!window.supabase?.createClient), 'Supabase SDK niet geladen');
      const badAssets = await page.evaluate(async () => {
        const assets = [...document.querySelectorAll('script[src],link[rel="stylesheet"],link[rel="icon"],link[rel="manifest"],link[rel="apple-touch-icon"],img[src]')]
          .map(element => element.src || element.href).filter(url => new URL(url).origin === location.origin);
        const checks = await Promise.all([...new Set(assets)].map(async url => ({ url, status: (await fetch(url)).status })));
        return checks.filter(check => check.status !== 200);
      });
      assert.deepEqual(badAssets, []);
      if (route === '/') {
        assert.ok(await page.locator('#publicRequestForm').isVisible());
        await page.evaluate(() => {
          const form = document.querySelector('#publicRequestForm');
          form.querySelector('[name="phone"]').value = '';
          form.querySelector('[name="email"]').value = '';
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });
        assert.match(await page.locator('#requestStatus').textContent(), /Vul minimaal een telefoonnummer of e-mailadres in/);
        console.log('PASS: openbare pagina, assets en contactvalidatie zonder verzending');
      } else {
        assert.equal(new URL(page.url()).pathname, '/inloggen/');
        assert.ok(await page.locator('#loginForm').isVisible());
        assert.equal(await page.locator('#loginError').isVisible(), false);
        assert.equal(await page.locator('#loginForm').evaluate(form => form.checkValidity()), false);
        if (route === '/app/') assert.equal(new URL(page.url()).searchParams.get('next'), '/app/');
        console.log(`PASS: ${route === '/app/' ? 'beveiligde app-doorverwijzing' : 'inlogpagina'} en assets`);
      }
    }
    await page.addScriptTag({ url: origin + '/app/db.js' });
    assert.equal(await page.evaluate(async () => {
      await JKDB.open();
      for (const store of JKDB.stores) {
        if ((await JKDB.all(store)).length) return false;
      }
      await JKDB.putLocal('settings', { id: 'regression-fixture', value: 'test' });
      const saved = await JKDB.get('settings', 'regression-fixture');
      await JKDB.removeLocal('settings', 'regression-fixture');
      return saved.value === 'test' && !await JKDB.get('settings', 'regression-fixture');
    }), true);
    console.log('PASS: lokale IndexedDB lezen/schrijven/verwijderen in wegwerp-browserprofiel');
    assert.deepEqual(mutations, [], 'Externe of lokale HTTP-schrijfactie geprobeerd');
    assert.deepEqual(failures, [], 'Browser- of resourcefouten');
    await require('./test_manual_backup.cjs')(browser, origin);
    console.log('Backend: uitsluitend fixtures; echte productie-Supabase en apparaatdeelkaart niet getest.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
