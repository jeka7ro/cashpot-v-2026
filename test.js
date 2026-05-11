const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('http://localhost:5050/#rapoarte/hh');
  await page.waitForTimeout(2000);
  
  const html = await page.evaluate(() => {
    const hh = document.getElementById('rep-page-hh');
    return hh ? hh.outerHTML : 'null';
  });
  
  console.log(html.substring(0, 500));
  await browser.close();
})();
