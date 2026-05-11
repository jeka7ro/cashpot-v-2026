const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5050/#rapoarte/hh');
  
  await new Promise(r => setTimeout(r, 2000));
  
  const display = await page.evaluate(() => {
    return {
      vol_rows: document.querySelectorAll('#hh-vol-body tr').length,
      dep_rows: document.querySelectorAll('#hh-dep-body tr').length,
      insight_text: document.getElementById('hh-smart-insights')?.innerText,
      insight_adv: document.getElementById('hh-smart-insight')?.innerText,
    };
  });
  
  console.log('DISPLAY STATUS:', display);
  await browser.close();
})();
