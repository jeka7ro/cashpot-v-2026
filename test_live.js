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
  const d = await get('http://localhost:5050/api/live?active_only=true');
  console.log("Length:", d.top_machines.length);
  for (let i = 0; i < 5; i++) {
    console.log(d.top_machines[i]);
  }
}
test().catch(console.error);
