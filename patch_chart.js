import fs from 'fs';
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(
  `{ label: 'Cost Mediu HH', data: hrAgg.map(x => x.cnt>0 ? x.hh/x.cnt : 0), backgroundColor: 'rgba(239,68,68,0.8)', type: 'line', tension: 0.3 }`,
  `{ label: 'Cost Mediu HH', data: hrAgg.map(x => x.cnt>0 ? x.hh/x.cnt : 0), backgroundColor: 'rgba(239,68,68,0.8)', borderColor: 'rgba(239,68,68,1)', type: 'line', tension: 0.3, yAxisID: 'y1' }`
);

code = code.replace(
  `options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } } } }`,
  `options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { type: 'linear', display: true, position: 'left' }, y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } } } }`
);

fs.writeFileSync('app.js', code);
console.log("Patched hourly chart axis");
