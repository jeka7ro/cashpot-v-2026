import re

app_js_path = "/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js"
with open(app_js_path, "r") as f:
    content = f.read()

# Fix "0 m²"
content = content.replace("c.m2 ? `${c.m2} m²` : '0 m²'", "c.m2 ? `${c.m2} m²` : '-'")

# Fix "0 LEI" total
# Search for `<strong>${c.total_amount || 0} ${c.currency || 'LEI'}</strong>` or similar
content = re.sub(
    r"\$\{c\.total_amount \|\| 0\} \$\{c\.currency \|\| 'LEI'\}", 
    r"${c.total_amount ? c.total_amount + ' ' + (c.currency || 'LEI') : '-'}", 
    content
)

content = re.sub(
    r"\$\{Number\(c\.total_amount\)\.toLocaleString\('ro-RO'\) \|\| 0\} \$\{c\.currency \|\| 'LEI'\}",
    r"${c.total_amount ? Number(c.total_amount).toLocaleString('ro-RO') + ' ' + (c.currency || 'LEI') : '-'}",
    content
)

# Fix Preaviz: 0 luni
content = content.replace(
    "if (c.notice_period_months) statusHtml += `<br><span style=\"font-size:11px; color:var(--muted)\">Preaviz: ${c.notice_period_months} luni</span>`;",
    "if (c.notice_period_months && c.notice_period_months > 0) statusHtml += `<br><span style=\"font-size:11px; color:var(--muted)\">Preaviz: ${c.notice_period_months} luni</span>`;"
)

with open(app_js_path, "w") as f:
    f.write(content)
