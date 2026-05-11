const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function test() {
  const [daily, adv, hour] = await Promise.all([
    get('http://localhost:5050/api/daily?res=day&start=2026-05-01&end=2026-05-31&loc_ids=5'),
    get('http://localhost:5050/api/hh_advanced?start=2026-05-01&end=2026-05-31&loc_ids=5'),
    get('http://localhost:5050/api/daily?res=hour&start=2026-05-01&end=2026-05-31&loc_ids=5')
  ]);
  console.log("Daily length:", daily.length);
  console.log("Adv keys:", Object.keys(adv));
  console.log("Hour length:", hour.length);
}
test().catch(console.error);
