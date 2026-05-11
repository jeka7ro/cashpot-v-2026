const fs = require('fs');
const html = fs.readFileSync('hh_html.txt', 'utf-8');
const lines = html.split('\n');
let depth = 0;
for(let i=0; i<lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/<div|<section|<table|<thead|<tbody|<tr|<th|<td/g) || []).length;
  const closes = (line.match(/<\/div>|<\/section>|<\/table>|<\/thead>|<\/tbody>|<\/tr>|<\/th>|<\/td>/g) || []).length;
  depth += opens - closes;
  if(depth < 0) console.log(`ERROR at line ${i+1}: Depth is ${depth}`);
}
console.log(`Final depth: ${depth}`);
