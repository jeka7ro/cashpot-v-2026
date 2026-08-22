import re
with open("app.js", "r") as f:
    content = f.read()

content = content.replace("table-analiza-rtp", "analiza-rtp-tbl")

with open("app.js", "w") as f:
    f.write(content)
print("Updated JS as well for table-analiza-rtp")
