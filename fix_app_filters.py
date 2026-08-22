with open("app.js", "r") as f:
    content = f.read()

start = content.find('window.filterAnalizaResetsTable = function() {')
if start != -1:
    end = content.find('};', start)
    
    new_js = """window.filterAnalizaResetsTable = function() {
  const fLoc = (document.getElementById('flt-resets-loc')?.value || '').toLowerCase();
  const fMix = (document.getElementById('flt-resets-mix')?.value || '').toLowerCase();
  const fSerial = (document.getElementById('flt-resets-serial')?.value || '').toLowerCase();
  
  if (!tableStates['analiza-resets'].rawData) return;
  
  if (!fLoc && !fMix && !fSerial) {
    tableStates['analiza-resets'].filteredRows = null;
  } else {
    tableStates['analiza-resets'].filteredRows = tableStates['analiza-resets'].rawData.map((r, i) => {
      const matchLoc = !fLoc || (r.locatie || '').toLowerCase().includes(fLoc);
      const matchMix = !fMix || (r.tip || '').toLowerCase().includes(fMix);
      const matchSerial = !fSerial || (r.serial || '').toLowerCase().includes(fSerial);
      
      if (matchLoc && matchMix && matchSerial) return tableStates['analiza-resets'].rows[i];
      return null;
    }).filter(row => row !== null);
  }
  
  renderTablePaginated('analiza-resets');
"""
    content = content[:start] + new_js + content[end:]
    with open("app.js", "w") as f:
        f.write(content)
        
    print("Fixed JS filters for resets")
