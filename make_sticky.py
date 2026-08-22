html_file = "/Users/eugeniucazmal/Downloads/dev_office/cashpot2/index.html"
with open(html_file, "r") as f:
    content = f.read()

# Make the TH sticky
content = content.replace(
    '<th style="padding:12px; width:40px; border-bottom:1px solid var(--border);">\n                <input type="checkbox" id="contract-select-all"',
    '<th style="padding:12px; width:40px; border-bottom:1px solid var(--border); position:sticky; left:0; z-index:2; background:var(--surface2);">\n                <input type="checkbox" id="contract-select-all"'
)

with open(html_file, "w") as f:
    f.write(content)

js_file = "/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js"
with open(js_file, "r") as f:
    js_content = f.read()

# Make the TD sticky
js_content = js_content.replace(
    '<td style="width:40px; text-align:center;"><input type="checkbox" class="contract-chk"',
    '<td style="width:40px; text-align:center; position:sticky; left:0; z-index:1; background:var(--surface); border-right:1px solid var(--border);"><input type="checkbox" class="contract-chk"'
)

with open(js_file, "w") as f:
    f.write(js_content)
