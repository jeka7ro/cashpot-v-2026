import re
with open("index.html", "r") as f:
    content = f.read()

# Make sure colspan is correct. Total columns = 12.
# We have empty th, loc, prod, serial, zile => 5 columns.
# Remaining columns = 12 - 5 = 7.
# We set colspan=7 previously. Let's verify.
