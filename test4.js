const http = require('http');
http.get('http://localhost:5050/api/hh_advanced?start=2026-05-01&end=2026-05-10', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data.substring(0, 1000)));
});
