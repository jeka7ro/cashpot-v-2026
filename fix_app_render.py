import re
app_js_path = "/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js"
with open(app_js_path, "r") as f:
    content = f.read()

# Fix the total_amount logic that I messed up
# Previous replace was:
# ${c.total_amount ? c.total_amount + ' ' + (c.currency || 'LEI') : '-'}
# We want it to be:
# ${c.total_amount !== null && c.total_amount !== undefined ? c.total_amount + ' ' + (c.currency || 'LEI') : '-'}

content = content.replace(
    "${c.total_amount ? c.total_amount + ' ' + (c.currency || 'LEI') : '-'}",
    "${c.total_amount !== null && c.total_amount !== undefined ? c.total_amount + ' ' + (c.currency || 'LEI') : '-'}"
)

content = content.replace(
    "${c.total_amount ? Number(c.total_amount).toLocaleString('ro-RO') + ' ' + (c.currency || 'LEI') : '-'}",
    "${c.total_amount !== null && c.total_amount !== undefined ? Number(c.total_amount).toLocaleString('ro-RO') + ' ' + (c.currency || 'LEI') : '-'}"
)

with open(app_js_path, "w") as f:
    f.write(content)
