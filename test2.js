const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto('http://localhost:5050/#rapoarte/hh');
  
  await new Promise(r => setTimeout(r, 3000));
  
  const display = await page.evaluate(() => {
    return {
      hh: document.getElementById('rep-page-hh')?.style.display,
      ore: document.getElementById('rep-page-ore')?.style.display,
      rapoarte: document.getElementById('view-rapoarte')?.classList.contains('active'),
      cardHeight: document.querySelector('#rep-page-hh .card')?.clientHeight,
      innerHTML: document.querySelector('#rep-page-hh .card')?.innerHTML.substring(0, 200)
    };
  });
  
  console.log('DISPLAY STATUS:', display);
  await browser.close();
})();
