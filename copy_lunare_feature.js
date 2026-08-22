async function copyLunareTable() {
  if (typeof _lunareData === 'undefined' || !_lunareData || _lunareData.length === 0) {
    showToast('Nu există date pentru a fi copiate!', 'error');
    return;
  }
  
  // Re-build dataTotal just like exportLunareExcel
  const monthlyData = {};
  _lunareData.forEach(r => {
    const m = r.month || 'Necunoscut';
    const loc = r.location_name || 'Necunoscut';
    if (!monthlyData[m]) {
      monthlyData[m] = { in: 0, out: 0, ggr: 0, ngr: 0, mkt: 0, win: 0, bet: 0, serials: new Set(), locs: {} };
    }
    if (!monthlyData[m].locs[loc]) {
      monthlyData[m].locs[loc] = { in: 0, out: 0, ggr: 0, ngr: 0, mkt: 0, win: 0, bet: 0, serials: new Set() };
    }
    
    monthlyData[m].in += (+r.in_val || 0);
    monthlyData[m].out += (+r.out_val || 0);
    monthlyData[m].ggr += (+r.ggr || 0);
    monthlyData[m].ngr += (+r.ngr || 0);
    monthlyData[m].mkt += (+r.marketing || 0);
    monthlyData[m].win += (+r.win || 0);
    monthlyData[m].bet += (+r.bet || 0);
    
    const daysActive = (+r.days_active || 0);
    if (r.serial_nr && daysActive >= 3) {
      monthlyData[m].serials.add(r.serial_nr);
      monthlyData[m].locs[loc].serials.add(r.serial_nr);
    }
    
    monthlyData[m].locs[loc].in += (+r.in_val || 0);
    monthlyData[m].locs[loc].out += (+r.out_val || 0);
    monthlyData[m].locs[loc].ggr += (+r.ggr || 0);
    monthlyData[m].locs[loc].ngr += (+r.ngr || 0);
    monthlyData[m].locs[loc].mkt += (+r.marketing || 0);
    monthlyData[m].locs[loc].win += (+r.win || 0);
    monthlyData[m].locs[loc].bet += (+r.bet || 0);
  });

  const dataTotal = [];
  const sortedMonths = Object.keys(monthlyData).sort((a,b) => b.localeCompare(a));
  
  sortedMonths.forEach(m => {
    const sortedLocs = Object.keys(monthlyData[m].locs).sort();
    dataTotal.push({
      'Lună / Locație': `${m} (TOTAL)`,
      'Aparate': monthlyData[m].serials.size,
      'IN': monthlyData[m].in,
      'IN Mediu': monthlyData[m].serials.size > 0 ? (monthlyData[m].in / monthlyData[m].serials.size) : 0,
      'OUT': monthlyData[m].out,
      'GGR': monthlyData[m].ggr,
      'GGR Mediu': monthlyData[m].serials.size > 0 ? (monthlyData[m].ggr / monthlyData[m].serials.size) : 0,
      'NGR': monthlyData[m].ngr,
      'MKT Cost': monthlyData[m].mkt,
      'WIN/BET %': monthlyData[m].bet > 0 ? (monthlyData[m].win / monthlyData[m].bet * 100).toFixed(2) + '%' : '0.00%',
      'WIN/BET NGR %': monthlyData[m].bet > 0 ? ((monthlyData[m].win - monthlyData[m].mkt) / monthlyData[m].bet * 100).toFixed(2) + '%' : '0.00%'
    });
    
    sortedLocs.forEach(loc => {
      const ld = monthlyData[m].locs[loc];
      if (!ld) return;
      if (ld.in === 0 && ld.out === 0 && ld.ggr === 0 && ld.mkt === 0 && (!ld.serials || ld.serials.size === 0)) return;

      dataTotal.push({
        'Lună / Locație': `  ${loc}`,
        'Aparate': ld.serials ? ld.serials.size : 0,
        'IN': ld.in,
        'IN Mediu': (ld.serials && ld.serials.size > 0) ? (ld.in / ld.serials.size) : 0,
        'OUT': ld.out,
        'GGR': ld.ggr,
        'GGR Mediu': (ld.serials && ld.serials.size > 0) ? (ld.ggr / ld.serials.size) : 0,
        'NGR': ld.ngr,
        'MKT Cost': ld.mkt,
        'WIN/BET %': ld.bet > 0 ? (ld.win / ld.bet * 100).toFixed(2) + '%' : '0.00%',
        'WIN/BET NGR %': ld.bet > 0 ? ((ld.win - ld.mkt) / ld.bet * 100).toFixed(2) + '%' : '0.00%'
      });
    });
  });

  let html = `<table style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px;">`;
  html += `<thead><tr>`;
  const headers = Object.keys(dataTotal[0]);
  headers.forEach(h => {
     html += `<th style="background-color: #F8FAFC; color: #1E293B; font-weight: bold; border: 1px solid #E2E8F0; padding: 4px;">${h}</th>`;
  });
  html += `</tr></thead><tbody>`;
  
  const roFormat = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const roFormatInt = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  
  dataTotal.forEach(row => {
     const isTotal = row['Lună / Locație'].includes('(TOTAL)');
     const bg = isTotal ? '#F1F5F9' : '#FFFFFF';
     const fw = isTotal ? 'bold' : 'normal';
     html += `<tr style="background-color: ${bg}; font-weight: ${fw};">`;
     headers.forEach(h => {
       let val = row[h];
       let v = parseFloat(val);
       let color = '#000000';
       if (!isNaN(v) && (h.includes('GGR') || h.includes('NGR') || h.includes('WIN'))) {
         if (v > 0) color = '#059669'; // green
         else if (v < 0) color = '#DC2626'; // red
       }
       
       let text = val;
       if (typeof val === 'number') {
         if (h === 'Aparate') text = roFormatInt.format(val);
         else text = roFormat.format(val);
       }
       
       html += `<td style="border: 1px solid #E2E8F0; padding: 4px; color: ${color}; text-align: ${typeof val === 'number' || val.toString().includes('%') ? 'right' : 'left'}">${text}</td>`;
     });
     html += `</tr>`;
  });
  html += `</tbody></table>`;
  
  let textStr = headers.join('\t') + '\n' + dataTotal.map(r => headers.map(h => {
       let val = r[h];
       if (typeof val === 'number' && h !== 'Aparate') return roFormat.format(val).replace(/\./g, '');
       return val;
  }).join('\t')).join('\n');
  
  try {
    const blobHtml = new Blob([html], { type: 'text/html' });
    const blobText = new Blob([textStr], { type: 'text/plain' });
    const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
    await navigator.clipboard.write(data);
    showToast('Tabelul a fost copiat în memorie (cu formatare)! Poți da Paste direct în Google Sheets.', 'success');
  } catch (err) {
    console.error(err);
    alert('Eroare la copiere. Browserul nu permite scrierea în Clipboard fără permisiune.');
  }
}
