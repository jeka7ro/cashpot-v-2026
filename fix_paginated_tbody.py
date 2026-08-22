import re
js_file = "/Users/eugeniucazmal/Downloads/dev_office/cashpot2/app.js"
with open(js_file, "r") as f:
    content = f.read()

# Replace hardcoded ID concatenation with robust fallback
old_logic = """function renderTablePaginated(key) {
  const st = tableStates[key];
  if(!st) return;
  const tbody = document.getElementById('body-' + key);
  const pgWrap = document.getElementById('pg-' + key);"""

new_logic = """function renderTablePaginated(key) {
  const st = tableStates[key];
  if(!st) return;
  const tbody = document.getElementById(st.tbody || ('body-' + key));
  const pgWrap = document.getElementById(st.pagination || ('pg-' + key));"""

content = content.replace(old_logic, new_logic)

with open(js_file, "w") as f:
    f.write(content)

