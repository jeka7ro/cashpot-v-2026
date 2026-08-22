import re

html_file = "/Users/eugeniucazmal/Downloads/dev_office/cashpot2/index.html"
with open(html_file, "r") as f:
    content = f.read()

# Make sure we don't display "0 LEI" or "Preaviz: 0 luni" if the value is 0 or null.
# Wait, this is handled in app.js probably when rendering the rows! Let's check app.js.
