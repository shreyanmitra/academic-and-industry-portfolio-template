/* Optional browser verification. Build _site-root and _site-project first. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const screenshots = path.join(root, 'local/screenshots');
fs.mkdirSync(screenshots, { recursive: true });
const types = {'.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.svg':'image/svg+xml', '.xml':'application/xml', '.txt':'text/plain'};
const server = http.createServer((req, res) => {
  let route;
  try { route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const prefix = '/academic-and-industry-portfolio-template';
  const project = route === prefix || route.startsWith(prefix + '/');
  const directory = path.resolve(root, project ? '_site-project' : '_site-root');
  if (project) route = route.slice(prefix.length);
  let file = path.resolve(directory, '.' + (route || '/'));
  if (!file.startsWith(directory + path.sep) && file !== directory) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless:true, ...(process.env.PORTFOLIO_BROWSER_CHANNEL ? {channel:process.env.PORTFOLIO_BROWSER_CHANNEL} : {})});
  try {
    for (const base of ['', '/academic-and-industry-portfolio-template']) {
      const context = await browser.newContext({viewport:{width:1440,height:1000}, reducedMotion:'reduce'});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.goto(origin + base + '/', {waitUntil:'networkidle'});
      assert.equal(await page.locator('h1').innerText(), 'Your Name');
      assert.equal(await page.locator('.social-links a').count(), 0, 'Empty optional profiles must be hidden');
      assert.equal(await page.locator('.portrait-live, .portrait-anim').count(), 0, 'Blank animation paths must not create media');
      assert.equal(await page.locator('.portrait').evaluate(image => image.complete && image.naturalWidth > 0), true);
      await page.screenshot({path:path.join(screenshots, `home-desktop${base ? '-project' : ''}.png`)});
      await page.goto(origin + base + '/projects/', {waitUntil:'networkidle'});
      await page.locator('[data-filter-group="project-results"] [data-filter="Applications"]').click();
      assert.equal(await page.locator('#project-results .work-card:not([hidden])').count(), 1);
      assert.match(await page.locator('#project-count').innerText(), /1 project shown/);
      await page.locator('[data-filter-group="skill-cloud"] [data-filter="Software"]').click();
      assert.equal(await page.locator('#skill-cloud li:not([hidden])').count(), 3);
      await page.locator('[data-filter-group="project-results"] [data-filter="All"]').click();
      if (!base) { await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); }); await page.screenshot({path:path.join(screenshots, 'projects-desktop.png'), fullPage:true}); }
      await page.setViewportSize({width:390,height:844});
      await page.goto(origin + base + '/', {waitUntil:'networkidle'});
      const menu = page.locator('.menu-toggle');
      await menu.click();
      assert.equal(await menu.getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await menu.getAttribute('aria-expanded'), 'false');
      await menu.click();
      await page.locator('#primary-nav').getByRole('link',{name:'Experience',exact:true}).click();
      await page.waitForURL(origin + base + '/experience/');
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Mobile overflow');
      await page.goto(origin + base + '/', {waitUntil:'networkidle'});
      if (!base) await page.screenshot({path:path.join(screenshots, 'home-mobile.png')});
      assert.deepEqual(errors, []);
      await context.close();
    }
    const nojs = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
    const page = await nojs.newPage();
    await page.goto(origin + '/');
    assert.equal(await page.locator('h1').isVisible(), true);
    assert.equal(await page.locator('.research-cell').first().isVisible(), true);
    assert.equal(await page.locator('#primary-nav a').first().isVisible(), true);
    await nojs.close();
    console.log('Browser checks passed: root/project URLs, desktop/mobile, navigation, filters, optional links/media, no JavaScript, and reduced motion.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
