import re

with open('dashboard2.js', 'r') as f:
    content = f.read()

# For the simple ones: if (document.getElementById('echart-top-loc') && locsData) {
pattern = r"if\s*\(\s*document\.getElementById\('([^']+)'\)(.*?)\)\s*\{"

def replacement(match):
    chart_id = match.group(1)
    rest_of_cond = match.group(2)
    
    # Avoid double patching
    if "chartDateOverrides" in rest_of_cond:
        return match.group(0)
        
    return f"if (document.getElementById('{chart_id}'){rest_of_cond} && (!window.chartDateOverrides['{chart_id}'] || targetChartId === '{chart_id}')) {{"

content = re.sub(pattern, replacement, content)

# There is a nested bot-loc inside the top-loc block:
if "echart-bot-loc" in content:
    # Actually bot-loc doesn't have a document.getElementById('echart-bot-loc') check at the top level, 
    # it is inside if (document.getElementById('echart-top-loc') && locsData)
    # Wait, let's check if bot-loc has its own check.
    pass

# We also need to fix domCombo, domWaterfall, domTimeline
patterns_dom = [
    (r"const domCombo = document\.getElementById\('echart-combo'\);\s*if \(domCombo\)", 'echart-combo'),
    (r"const domWaterfall = document\.getElementById\('echart-waterfall'\);\s*if \(domWaterfall\)", 'echart-waterfall'),
    (r"const domTimeline = document\.getElementById\('echart-timeline'\);\s*if \(domTimeline\)", 'echart-timeline'),
]

for pat, cid in patterns_dom:
    rep = f"const dom_{cid.replace('-','_')} = document.getElementById('{cid}');\n    if (dom_{cid.replace('-','_')} && (!window.chartDateOverrides['{cid}'] || targetChartId === '{cid}'))"
    # Note: re.sub won't match exactly because of whitespace, let's use string replace for these specific ones
    # Actually regex with \s* is better
    content = re.sub(pat, rep, content)

with open('dashboard2.js', 'w') as f:
    f.write(content)

