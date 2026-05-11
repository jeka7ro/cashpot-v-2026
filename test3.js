const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5050/#rapoarte/hh');
  
  await new Promise(r => setTimeout(r, 2000));
  
  const activePanels = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.view-panel.active')).map(p => p.id);
  });
  
  console.log('ACTIVE PANELS:', activePanels);
  await browser.close();
})();
