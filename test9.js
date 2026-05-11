const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('http://localhost:5050/#rapoarte/hh');
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.evaluate(() => {
    return document.getElementById('rep-page-hh').innerHTML;
  });
  require('fs').writeFileSync('hh_html.txt', html);
  await browser.close();
  console.log('Saved to hh_html.txt');
})();
