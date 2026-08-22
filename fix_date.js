function sanitizeDateStr(dStr) {
  if (!dStr) return dStr;
  let y, m, d;
  if (dStr.includes('.')) {
    const p = dStr.split('.');
    d = parseInt(p[0], 10);
    m = parseInt(p[1], 10);
    y = parseInt(p[2], 10);
  } else {
    const p = dStr.split('-');
    y = parseInt(p[0], 10);
    m = parseInt(p[1], 10);
    d = parseInt(p[2], 10);
  }
  if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
    if (m < 1) m = 1;
    if (m > 12) m = 12;
    let lastDay = new Date(y, m, 0).getDate();
    if (d < 1) d = 1;
    if (d > lastDay) d = lastDay;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  const today = new Date();
  return today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
}
console.log(sanitizeDateStr('01.05.2026'));
console.log(sanitizeDateStr('2026-06-31'));
console.log(sanitizeDateStr('NaN-NaN-NaN'));
