const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log('BROWSER CONSOLE:', msg.text());
  });
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });
  
  // Fake login by setting localStorage
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('auth_token', 'fake_token');
    localStorage.setItem('user', JSON.stringify({ role: 'Super Admin', email: 'test@test.com' }));
  });
  
  // Go to the app
  await page.goto('http://localhost:5050/#rapoarte/lunare', { waitUntil: 'networkidle0' });
  
  // Wait a bit just in case
  await new Promise(r => setTimeout(r, 2000));
  
  // Check the state of the DOM
  const result = await page.evaluate(() => {
    const viewRapoarte = document.getElementById('view-rapoarte');
    const repPageLunare = document.getElementById('rep-page-lunare');
    const tbody = document.getElementById('body-rep-lunare');
    
    return {
      viewRapoarteActive: viewRapoarte ? viewRapoarte.classList.contains('active') : false,
      viewRapoarteDisplay: viewRapoarte ? window.getComputedStyle(viewRapoarte).display : null,
      repPageLunareDisplay: repPageLunare ? window.getComputedStyle(repPageLunare).display : null,
      tbodyHtmlLength: tbody ? tbody.innerHTML.length : -1,
      lunareDataLength: window._lunareData ? window._lunareData.length : -1,
      url: window.location.href,
      hash: window.location.hash
    };
  });
  
  console.log(JSON.stringify(result, null, 2));
  
  await browser.close();
})();
