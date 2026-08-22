with open("app.js", "r") as f:
    content = f.read()

start = content.find("document.getElementById('analiza-rtp-count').innerText = data.length;")

new_code = """
    document.getElementById('analiza-rtp-count').innerText = data.length;
    
    // Calculați totalurile pentru RTP Teoretic table
    let tIn = 0, tOut = 0, tMkt = 0, tGgr = 0;
    data.forEach(r => {
        tIn += r.total_in || 0;
        tOut += r.total_out || 0;
        tMkt += r.marketing || 0;
        tGgr += r.ggr || 0;
    });
    
    const overallRtp = tIn > 0 ? (tOut / tIn) * 100 : 0;
    
    const foot = document.getElementById('foot-analiza-rtp');
    if (foot) {
        foot.innerHTML = `
            <tr>
                <th colspan="5" style="text-align:right; padding:12px;">TOTAL:</th>
                <th style="text-align:right; padding:12px;">${fmt(tIn, 2)}</th>
                <th style="text-align:right; padding:12px;">${fmt(tOut, 2)}</th>
                <th style="text-align:right; padding:12px;">${fmt(tMkt, 2)}</th>
                <th style="text-align:right; padding:12px;">${fmt(tGgr, 2)}</th>
                <th style="text-align:right; color:#eab308; padding:12px;">${overallRtp.toFixed(2)}%</th>
                <th colspan="2"></th>
            </tr>
        `;
    }
    
"""
if start != -1:
    content = content[:start] + new_code + content[start+len("document.getElementById('analiza-rtp-count').innerText = data.length;"):]
    with open("app.js", "w") as f:
        f.write(content)
    print("Added footer to app.js")
