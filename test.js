const fs = require('fs');
const code = fs.readFileSync('/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js', 'utf8');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM(`
  <div id="body-rep-lunare"></div>
  <div id="foot-rep-lunare"></div>
  <div id="head-rep-lunare-total"></div>
  <div id="body-rep-lunare-total"></div>
  <div id="foot-rep-lunare-total"></div>
`);
global.document = dom.window.document;
global.window = dom.window;

let _lunareData = [
  { serial_nr: "123", in_val: 10, out_val: 5, ggr: 5, marketing: 0, ngr: 5, month: "2026-08", location_name: "Craiova" }
];
let tableStates = { 'rep-lunare': { rows: [] } };
function fmt(val) { return val; }
function renderTablePaginated() {}
function updatePaginationControls() {}
let sortState = {};

// We will extract renderLunareReport from the code using regex or just run the code
const renderStr = code.substring(code.indexOf('function renderLunareReport'), code.indexOf('window.exportLunareExcel'));
eval(renderStr);
try {
  renderLunareReport();
  console.log("Success! bodyTotal:", document.getElementById('body-rep-lunare-total').innerHTML.substring(0, 50));
} catch(e) {
  console.error("CRASH:", e);
}
