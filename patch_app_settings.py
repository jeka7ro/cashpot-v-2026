import re

with open('app.js', 'r') as f:
    content = f.read()

# I already appended `loadExpensesConfig` and `saveExpensesConfig` using patch_settings.py! 
# Let me verify if they exist in app.js
if "loadExpensesConfig()" in content:
    print("Found loadExpensesConfig")
    
    # We just need to hook them. Let's see `saveSettings()`.
    content = content.replace("function saveSettings() {", "function saveSettings() {\n  if(window.saveExpensesConfig) window.saveExpensesConfig();")
    
    with open('app.js', 'w') as f:
        f.write(content)
else:
    print("Not found loadExpensesConfig")
