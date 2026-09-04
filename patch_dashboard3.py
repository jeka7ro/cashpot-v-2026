with open('dashboard2.js', 'r') as f:
    content = f.read()

# Replace all bad accesses
# 1. Calendar
content = content.replace("trendData.map(t => [t.date, Math.round(t.ggr)]);", "trendData.map(t => [t.date || t.zi, Math.round(t.ggr)]);")
content = content.replace("trendData[0].date.substring(0,4)", "(trendData[0].date || trendData[0].zi || String(new Date().getFullYear())).substring(0,4)")

# 2. Radar
content = content.replace("let day = (new Date(t.date).getDay() + 6) % 7;", "let day = (new Date(t.date || t.zi).getDay() + 6) % 7;")

# 3. RTP VS HOLD
content = content.replace("trendData.map(t => [t.date, t.total_in", "trendData.map(t => [t.date || t.zi, t.total_in")
content = content.replace("trendData.map(t=>t.date.substring(5))", "trendData.map(t=>(t.date || t.zi || '').substring(5))")

# 4. JACKPOTS
content = content.replace("let dates = trendData.map(t => t.date.substring(5));", "let dates = trendData.map(t => (t.date || t.zi || '').substring(5));")

# Let's also fix l.location -> l.locatie in scatter and top/bot
content = content.replace("l.location.toLowerCase()", "(l.locatie || l.location || '').toLowerCase()")
content = content.replace("l => l.location)", "l => l.locatie || l.location)")
content = content.replace("return [exp, l.ggr, l.total_in, l.location];", "return [exp, l.ggr, l.total_in, l.locatie || l.location];")

with open('dashboard2.js', 'w') as f:
    f.write(content)
