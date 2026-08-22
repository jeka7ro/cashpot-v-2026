with open("app.js", "r") as f:
    content = f.read()

start = content.find("window.openMachineDetails = async function(serial) {")
end = content.find("window.filterAnalizaResetsTable", start)

new_code = """window.openMachineDetails = async function(serial) {
  // Hide all other pages
  document.querySelectorAll('.rep-page').forEach(p => p.style.display = 'none');
  
  const page = document.getElementById('analiza-machine-details');
  if (!page) return;
  page.style.display = 'block';
  
  // Reset contents and show loading
  document.getElementById('md-serial').innerText = serial;
  document.getElementById('md-mix').innerText = '...';
  document.getElementById('md-loc').innerText = '...';
  document.getElementById('md-stat-in').innerText = '0.00';
  document.getElementById('md-stat-out').innerText = '0.00';
  document.getElementById('md-stat-jp').innerText = '0.00';
  
  document.getElementById('md-loc-tbody').innerHTML = '<tr><td colspan="10" style="text-align:center;"><div class="spinner"></div></td></tr>';
  document.getElementById('md-res-tbody').innerHTML = '<tr><td colspan="3" style="text-align:center;"><div class="spinner"></div></td></tr>';
  document.getElementById('md-pay-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;"><div class="spinner"></div></td></tr>';
  
  try {
    const data = await api(`/api/machine/${serial}/details`);
    
    // Quick stats
    if (data.location_history && data.location_history.length > 0) {
      document.getElementById('md-loc').innerText = data.location_history[0].location_name;
    }
    document.getElementById('md-stat-in').innerText = fmt(data.stats.total_in, 2);
    document.getElementById('md-stat-out').innerText = fmt(data.stats.total_out, 2);
    document.getElementById('md-stat-jp').innerText = fmt(data.stats.total_jp, 2);
    
    // Mix - find from original table or data
    const row = tableStates['analiza-resets']?.rawData?.find(r => r.serial == serial);
    if (row) document.getElementById('md-mix').innerText = row.tip;
    
    // Initialize Table States for the three tabs
    tableStates['md-loc'] = { page: 1, limit: 10, tbody: 'md-loc-tbody', pagination: 'pg-md-loc-table', rows: [] };
    tableStates['md-res'] = { page: 1, limit: 10, tbody: 'md-res-tbody', pagination: 'pg-md-res-table', rows: [] };
    tableStates['md-pay'] = { page: 1, limit: 10, tbody: 'md-pay-tbody', pagination: 'pg-md-pay-table', rows: [] };
    
    // 1. Location History
    let t_loc_in = 0, t_loc_out = 0, t_loc_jp = 0, t_loc_hh = 0, t_loc_ggr = 0;
    if (data.location_history && data.location_history.length > 0) {
      tableStates['md-loc'].rows = data.location_history.map((l, i) => {
        const _in = parseFloat(l.total_in) || 0;
        const _out = parseFloat(l.total_out) || 0;
        const _jp = parseFloat(l.total_jp) || 0;
        const _hh = parseFloat(l.total_hh) || 0;
        const _ggr = _in - _out;
        const _rtp = _in > 0 ? (_out / _in) * 100 : 0;
        
        t_loc_in += _in; t_loc_out += _out; t_loc_jp += _jp; t_loc_hh += _hh; t_loc_ggr += _ggr;
        
        return `
          <tr>
            <td style="text-align:center;">${i+1}</td>
            <td style="text-align:left; font-weight:bold;">${l.location_name}</td>
            <td style="text-align:center;">${l.created_at}</td>
            <td style="text-align:center;">${l.deleted_at}</td>
            <td style="text-align:right;">${fmt(_in, 2)}</td>
            <td style="text-align:right;">${fmt(_out, 2)}</td>
            <td style="text-align:right;">${fmt(_jp, 2)}</td>
            <td style="text-align:right;">${fmt(_hh, 2)}</td>
            <td style="text-align:right; font-weight:bold; color:${_ggr >= 0 ? 'var(--success)' : 'var(--danger)'};">${fmt(_ggr, 2)}</td>
            <td style="text-align:right; font-weight:bold; color:var(--warning);">${_rtp.toFixed(2)}%</td>
          </tr>
        `;
      });
    }
    document.getElementById('md-loc-tot-in').innerText = fmt(t_loc_in, 2);
    document.getElementById('md-loc-tot-out').innerText = fmt(t_loc_out, 2);
    document.getElementById('md-loc-tot-jp').innerText = fmt(t_loc_jp, 2);
    document.getElementById('md-loc-tot-hh').innerText = fmt(t_loc_hh, 2);
    document.getElementById('md-loc-tot-ggr').innerText = fmt(t_loc_ggr, 2);
    document.getElementById('md-loc-tot-rtp').innerText = (t_loc_in > 0 ? ((t_loc_out/t_loc_in)*100).toFixed(2) : '0.00') + '%';
    renderTablePaginated('md-loc');
    
    // 2. Resets History
    if (data.resets_history && data.resets_history.length > 0) {
      tableStates['md-res'].rows = data.resets_history.map((r, i) => `
        <tr>
          <td style="text-align:center;">${i+1}</td>
          <td style="text-align:center; color:var(--accent); font-weight:600;">${r.date}</td>
          <td style="text-align:left;">${r.location_name}</td>
        </tr>
      `);
      document.getElementById('md-res-tot').innerText = data.resets_history.length;
    } else {
      document.getElementById('md-res-tot').innerText = '0';
    }
    renderTablePaginated('md-res');
    
    // 3. Large Payouts
    let t_pay_out = 0, t_pay_jp = 0, t_pay_hh = 0;
    if (data.large_payouts && data.large_payouts.length > 0) {
      tableStates['md-pay'].rows = data.large_payouts.map((p, i) => {
        const _o = parseFloat(p.out) || 0;
        const _j = parseFloat(p.jackpot) || 0;
        const _h = parseFloat(p.hh) || 0;
        t_pay_out += _o; t_pay_jp += _j; t_pay_hh += _h;
        return `
          <tr>
            <td style="text-align:center;">${i+1}</td>
            <td style="text-align:center;">${p.date}</td>
            <td style="text-align:left;">${p.location_name}</td>
            <td style="text-align:right; color:var(--danger); font-weight:bold;">${fmt(_o, 2)}</td>
            <td style="text-align:right; color:var(--warning); font-weight:bold;">${fmt(_j, 2)}</td>
            <td style="text-align:right; color:#a855f7; font-weight:bold;">${fmt(_h, 2)}</td>
          </tr>
        `;
      });
    }
    document.getElementById('md-pay-tot-out').innerText = fmt(t_pay_out, 2);
    document.getElementById('md-pay-tot-jp').innerText = fmt(t_pay_jp, 2);
    document.getElementById('md-pay-tot-hh').innerText = fmt(t_pay_hh, 2);
    renderTablePaginated('md-pay');
    
  } catch(err) {
    console.error(err);
    document.getElementById('md-loc-tbody').innerHTML = `<tr><td colspan="10" style="text-align:center; color:red;">Eroare: ${err.message}</td></tr>`;
    document.getElementById('md-res-tbody').innerHTML = `<tr><td colspan="3" style="text-align:center; color:red;">Eroare: ${err.message}</td></tr>`;
    document.getElementById('md-pay-tbody').innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Eroare: ${err.message}</td></tr>`;
  }
};

window.closeMachineDetails = function() {
  document.getElementById('analiza-machine-details').style.display = 'none';
  document.getElementById('analiza-resets').style.display = 'block';
};

"""
if start != -1 and end != -1:
    content = content[:start] + new_code + content[end:]
    with open("app.js", "w") as f:
        f.write(content)
    print("Updated app.js successfully.")
else:
    print("Could not find boundaries")
