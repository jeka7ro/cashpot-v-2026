import fs from 'fs';

let code = fs.readFileSync('app.js', 'utf8');

const newCode = `
// ─── Location Analysis Page ────────────────────────────────────────────────────────
let laEvoChart = null, laDepChart = null, laHourlyChart = null;

window.closeLocAnalysisPage = function() {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  const prevHash = _daPrevView || '#dashboard';
  
  if (prevHash.startsWith('#rapoarte/')) {
      document.getElementById('view-rapoarte').classList.add('active');
      const subHash = prevHash.replace('#rapoarte/', '');
      document.querySelectorAll('.rep-page').forEach(p => p.style.display = 'none');
      const repTarget = document.getElementById('rep-page-' + subHash);
      if (repTarget) repTarget.style.display = 'block';
      const prevNav = document.querySelector(\`.nav-item[href="#rapoarte"]\`);
      if (prevNav) prevNav.classList.add('active');
      const subLink = document.querySelector(\`.subnav-group .nav-item[href="#rapoarte/\${subHash}"]\`);
      if (subLink) {
          document.querySelectorAll('.subnav-group .nav-item').forEach(b => b.classList.remove('active'));
          subLink.classList.add('active');
      }
  } else {
      const prevNav = document.querySelector(\`.nav-item[href="\${prevHash}"]\`);
      if (prevNav) prevNav.classList.add('active');
      const viewId = 'view-' + prevHash.replace('#','');
      const panel = document.getElementById(viewId);
      if (panel) panel.classList.add('active');
      else document.getElementById('view-dashboard').classList.add('active');
  }
};

window.openLocationAnalysis = async function(locName, locId) {
  _daPrevView = window.location.hash || '#dashboard';
  showLoader(true);
  
  const {s, e} = getPeriod();
  
  try {
    const [dailyData, advDataObj, hourlyData] = await Promise.all([
      api(\`/api/daily?res=day&start=\${s}&end=\${e}&loc_ids=\${locId}\`),
      api(\`/api/hh_advanced?start=\${s}&end=\${e}&loc_ids=\${locId}\`),
      api(\`/api/daily?res=hour&start=\${s}&end=\${e}&loc_ids=\${locId}\`)
    ]);

    document.querySelectorAll('.view-panel').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(a=>a.classList.remove('active'));
    document.getElementById('view-loc-analysis').classList.add('active');
    document.getElementById('loc-analysis-page-title').textContent = \`Analiză Locație: \${locName}\`;
    
    // KPI Data
    let totalIn = 0, totalGgr = 0, totalHh = 0, zileHh = 0;
    const dates = [], dataIn = [], dataGgr = [], dataHh = [];
    
    dailyData.forEach(r => {
      totalIn += (r.total_in || 0);
      totalGgr += (r.ggr || 0);
      totalHh += (r.hh || 0);
      if (r.hh > 0) zileHh++;
      dates.push(r.date);
      dataIn.push(r.total_in || 0);
      dataGgr.push(r.ggr || 0);
      dataHh.push(r.hh || 0);
    });

    document.getElementById('la-kpi-row').innerHTML = [
      {label:'Total IN', val:\`\${fmt(totalIn)} RON\`, sub:'', color:'var(--text)'},
      {label:'GGR Real', val:\`\${fmt(totalGgr)} RON\`, sub:'', color: totalGgr>=0?'var(--green)':'var(--red)'},
      {label:'Zile cu HH', val:zileHh, sub:'', color:'var(--accent)'},
      {label:'Cost HH', val:\`\${fmt(totalHh)} RON\`, sub:'', color:'var(--danger)'}
    ].map(k => \`
      <div class="kpi-card" style="padding:16px;">
        <div class="kpi-label" style="font-size:11px; margin-bottom:8px;">\${k.label} \${k.sub?\`<span style="opacity:.6;font-weight:400;margin-left:4px">(\${k.sub})</span>\`:\`\`}</div>
        <div class="kpi-value" style="font-size:20px; color:\${k.color}">\${k.val}</div>
      </div>
    \`).join('');

    // Insights Box
    const adv = advDataObj && advDataObj[locId] ? advDataObj[locId] : null;
    const ibox = document.getElementById('la-insight-box');
    if (adv) {
      ibox.innerHTML = adv.insight;
      if (adv.alerta === 'ROSU') { ibox.style.borderColor = 'var(--danger)'; ibox.style.color = 'var(--danger)'; ibox.style.backgroundColor = 'rgba(239,68,68,0.1)'; }
      else if (adv.alerta === 'PORTOCALIU') { ibox.style.borderColor = 'var(--warning)'; ibox.style.color = 'var(--warning)'; ibox.style.backgroundColor = 'rgba(245,158,11,0.1)'; }
      else { ibox.style.borderColor = 'var(--success)'; ibox.style.color = 'var(--success)'; ibox.style.backgroundColor = 'rgba(34,197,94,0.1)'; }
    } else {
      ibox.style.display = 'none';
    }

    // Chart 1: Evo
    if (laEvoChart) laEvoChart.destroy();
    laEvoChart = new Chart(document.getElementById('la-evo-chart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          { label: 'Total IN', data: dataIn, backgroundColor: 'rgba(99,102,241,0.8)', order: 3 },
          { label: 'Cost HH', data: dataHh, backgroundColor: 'rgba(239,68,68,0.8)', order: 2 },
          { label: 'GGR', data: dataGgr, type: 'line', borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.3, borderWidth: 2, order: 1 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false } }
    });

    // Chart 2: Top Dependent Machines (Bar)
    if (laDepChart) laDepChart.destroy();
    if (adv && adv.dependente && adv.dependente.length > 0) {
      const depLabels = adv.dependente.map(d => d.name.split(' (')[0]);
      const depData = adv.dependente.map(d => d.pct_in_hh);
      laDepChart = new Chart(document.getElementById('la-dep-pie').getContext('2d'), {
        type: 'bar',
        data: {
          labels: depLabels,
          datasets: [{ label: '% IN realizat în HH', data: depData, backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
      });
    } else {
      // clear canvas
      const ctx = document.getElementById('la-dep-pie').getContext('2d');
      ctx.clearRect(0,0,1000,1000);
      ctx.font = '12px Inter';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText('Niciun aparat nu e complet dependent de HH.', 150, 100);
    }

    // Chart 3: Hourly
    if (laHourlyChart) laHourlyChart.destroy();
    // Agregam orar (0-23)
    let hrAgg = Array(24).fill(0).map(()=>({in:0, hh:0, cnt:0}));
    hourlyData.forEach(r => {
      let h = parseInt(r.date.split(' ')[1].split(':')[0], 10);
      hrAgg[h].in += (r.total_in || 0);
      hrAgg[h].hh += (r.hh || 0);
      hrAgg[h].cnt += 1;
    });
    
    laHourlyChart = new Chart(document.getElementById('la-hourly-chart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: Array(24).fill(0).map((_,i)=>i+':00'),
        datasets: [
          { label: 'Rulaj Mediu (IN)', data: hrAgg.map(x => x.cnt>0 ? x.in/x.cnt : 0), backgroundColor: 'rgba(99,102,241,0.6)' },
          { label: 'Cost Mediu HH', data: hrAgg.map(x => x.cnt>0 ? x.hh/x.cnt : 0), backgroundColor: 'rgba(239,68,68,0.8)', type: 'line', tension: 0.3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } } } }
    });

  } catch(err) {
    console.error(err);
  } finally {
    showLoader(false);
  }
};
`

code = code.replace("window.openDayAnalysis = async function(dateStr) {", newCode + "\n\nwindow.openDayAnalysis = async function(dateStr) {");

fs.writeFileSync('app.js', code);
console.log("Updated app.js with openLocationAnalysis");
