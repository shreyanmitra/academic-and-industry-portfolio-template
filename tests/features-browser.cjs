const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'_site-root','.'+decodeURIComponent(pathname));
 const target=fs.existsSync(file)&&fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
 if(!target.startsWith(path.join(root,'_site-root')+path.sep)||!fs.existsSync(target)){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});fs.createReadStream(target).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,channel:process.env.PORTFOLIO_BROWSER_CHANNEL||'msedge'});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/');
  await page.locator('[data-theme-toggle]').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.screenshot({path:path.join(root,'local/theme-light-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(root,'local/theme-light-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(origin+'/classic/');
  await page.locator('.author__avatar img').waitFor();
  assert.equal(await page.locator('.author__avatar img').evaluate(image=>image.naturalWidth>0),true);
  await page.locator('#theme-toggle').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.locator('mjx-container').first().waitFor({timeout:45000});
  await page.locator('.mermaid svg').waitFor({timeout:45000});
  await page.locator('.academic-chart .main-svg').first().waitFor({timeout:45000});
  assert.equal(await page.locator('h1').isVisible(),true);
  await page.screenshot({path:path.join(root,'local/classic-desktop.png')});
  await page.goto(origin+'/markdown/');
  await page.locator('mjx-container').first().waitFor({timeout:45000});
  await page.locator('.mermaid svg').waitFor({timeout:45000});
  await page.locator('.academic-chart .main-svg').first().waitFor({timeout:45000});
  assert.equal(await page.locator('.academic-feature-error').count(),0);
  assert.equal(await page.locator('.academic-chart').evaluate(chart=>chart.layout.paper_bgcolor),'#101827');
  await page.locator('[data-theme-toggle]').click();
  await page.waitForFunction(()=>document.querySelector('.academic-chart').layout.paper_bgcolor === '#ffffff');
  await page.locator('[data-theme-toggle]').click();
  await page.waitForFunction(()=>document.querySelector('.academic-chart').layout.paper_bgcolor === '#101827');
  await page.screenshot({path:path.join(root,'local/writing-features.png'),fullPage:true});
  for(const route of ['/year-archive/','/categories/','/tags/','/blog/','/cv/','/cv-json/','/portfolio/']) {
   const response=await page.goto(origin+route);assert.equal(response.status(),200);assert.equal(await page.locator('h1').count(),1);
  }
  assert.deepEqual(errors,[]);
  console.log('Restored feature browser checks passed: persistent light/dark theme, classic sidebar, blog/taxonomy/CV routes, and actual MathJax/Mermaid/Plotly rendering.');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
