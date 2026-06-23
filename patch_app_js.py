import re

with open('app.js', 'r') as f:
    app_js = f.read()

# Replace table headers
old_headers = """          <th style="width:40px;">#</th>
          <th>Dată &amp; Oră</th>
          <th>Locație</th>
          <th>Aparat</th>
          <th class="num">In</th>
          <th class="num">Out</th>
          <th class="num">GGR</th>"""

new_headers = """          <th style="width:40px;">#</th>
          <th>Dată &amp; Oră</th>
          <th>Locație</th>
          <th>Aparat</th>
          <th class="num">Puncte</th>
          <th class="num">Rulaj (Bet)</th>"""

app_js = app_js.replace(old_headers, new_headers)

# Replace table body rendering
old_row = """        <tr>
          <td style="padding-left:16px; width:40px;"><input type="checkbox" class="row-checkbox"></td>
          <td style="width:40px;">${idx+1}</td>
          <td>${s.created_at.substring(0,16)}</td>
          <td>${s.locatie || '—'}</td>
          <td>
            <div style="font-weight:700; color:var(--text);">${s.serial_nr || '—'}</div>
            <div style="font-size:10px; color:var(--muted);">${prod} ${mixName}</div>
          </td>
          <td class="num" style="font-weight:700; color:var(--success);">${fmt(s.in)}</td>
          <td class="num">${fmt(s.out)}</td>
          <td class="num" style="font-weight:800; color:${s.ggr < 0 ? 'var(--danger)' : 'var(--success)'}">${fmt(s.ggr)}</td>
        </tr>"""

new_row = """        <tr>
          <td style="padding-left:16px; width:40px;"><input type="checkbox" class="row-checkbox"></td>
          <td style="width:40px;">${idx+1}</td>
          <td>${s.created_at.substring(0,16)}</td>
          <td>${s.locatie || '—'}</td>
          <td>
            <div style="font-weight:700; color:var(--text);">${s.serial_nr || '—'}</div>
            <div style="font-size:10px; color:var(--muted);">${prod} ${mixName}</div>
          </td>
          <td class="num" style="font-weight:700; color:var(--success);">${fmt(s.points)}</td>
          <td class="num" style="font-weight:800; color:var(--accent);">${fmt(s.total_bet)}</td>
        </tr>"""

app_js = app_js.replace(old_row, new_row)

# Update chart logic
old_chart = """      const ggr = s.ggr || 0;
      const sIn = s.in || 0;
      const sBet = s.bet || 0;
      
      const prodMix = (s.mix || s.producator || '');
      const mach = prodMix.trim().length > 2 ? prodMix.trim() : (s.serial_nr || 'Necunoscut');
      if (!machStats[mach]) machStats[mach] = 0;
      machStats[mach] += sIn; // activity metric = IN on machine days"""

new_chart = """      const points = s.points || 0;
      const sBet = s.total_bet || 0;
      
      const prodMix = (s.mix || s.producator || '');
      const mach = prodMix.trim().length > 2 ? prodMix.trim() : (s.serial_nr || 'Necunoscut');
      if (!machStats[mach]) machStats[mach] = 0;
      machStats[mach] += sBet; // activity metric = Bet on machine days"""

app_js = app_js.replace(old_chart, new_chart)

old_day_stats = """        if (!dayStats[day]) dayStats[day] = { in:0, bet:0, ggr:0 };
        dayStats[day].in  += sIn;
        dayStats[day].bet += sBet;
        dayStats[day].ggr += ggr;
        
        const hr = new Date(s.created_at).getHours();
        if (!isNaN(hr)) {
          hourStats[hr].in  += sIn;
          hourStats[hr].bet += sBet;
          hourStats[hr].ggr += ggr;
        }
        
        totalIn  += sIn;
        totalOut += (s.out || 0);
        totalBet += sBet;
        totalGGR += ggr;"""

new_day_stats = """        if (!dayStats[day]) dayStats[day] = { in:0, bet:0, ggr:0 };
        dayStats[day].bet += sBet;
        dayStats[day].ggr += points; // re-use ggr field for points in charts
        
        const hr = new Date(s.created_at).getHours();
        if (!isNaN(hr)) {
          hourStats[hr].bet += sBet;
          hourStats[hr].ggr += points;
        }
        
        totalBet += sBet;
        totalGGR += points;"""

app_js = app_js.replace(old_day_stats, new_day_stats)

with open('app.js', 'w') as f:
    f.write(app_js)

print("Patched app.js")
