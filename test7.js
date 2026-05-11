const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('response', response => {
    if (!response.ok()) {
      console.log('API FAILED:', response.url(), response.status());
    }
  });
  page.on('console', msg => console.log('LOG:', msg.text()));
  await page.goto('http://localhost:5050/#rapoarte/hh');
  await new Promise(r => setTimeout(r, 4000));
  await browser.close();
})();
