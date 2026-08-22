const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });
  
  // Go to the app
  await page.goto('http://localhost:5050/#rapoarte/lunare', { waitUntil: 'networkidle0' });
  
  // Check the state of the DOM
  const result = await page.evaluate(() => {
    const viewRapoarte = document.getElementById('view-rapoarte');
    const repPageLunare = document.getElementById('rep-page-lunare');
    const tbody = document.getElementById('body-rep-lunare');
    
    return {
      viewRapoarteActive: viewRapoarte ? viewRapoarte.classList.contains('active') : false,
      viewRapoarteDisplay: viewRapoarte ? window.getComputedStyle(viewRapoarte).display : null,
      viewRapoarteHeight: viewRapoarte ? viewRapoarte.getBoundingClientRect().height : null,
      repPageLunareDisplay: repPageLunare ? window.getComputedStyle(repPageLunare).display : null,
      repPageLunareHeight: repPageLunare ? repPageLunare.getBoundingClientRect().height : null,
      tbodyHtml: tbody ? tbody.innerHTML : null,
      lunareDataLength: window._lunareData ? window._lunareData.length : -1
    };
  });
  
  console.log(JSON.stringify(result, null, 2));
  
  await browser.close();
})();
