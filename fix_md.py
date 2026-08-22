with open("index.html", "r") as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
view_analiza_end = -1

for i, l in enumerate(lines):
    if '<!-- Machine Full Details Page -->' in l:
        start_idx = i
    if l.startswith('  <div id="view-analiza"'):
        pass # just tracking
    if '<!-- Editor Floorplan -->' in l:
        pass
    if '<!-- /view-analiza -->' in l or '<!-- End View Analiza -->' in l:
        pass

# we need to find the matching closing div for view-analiza (line 1144)
def find_matching_close(lines, start_line):
    stack = 0
    for i in range(start_line, len(lines)):
        line = lines[i]
        stack += line.count('<div')
        stack -= line.count('</div')
        if stack <= 0:
            return i
    return -1

view_analiza_end = find_matching_close(lines, 1143) # line 1144 is index 1143

print("Machine Details Start:", start_idx)
print("View Analiza End:", view_analiza_end)

if start_idx != -1 and view_analiza_end != -1 and start_idx > view_analiza_end:
    print("Moving Machine Details inside View Analiza...")
    
    # machine details goes until the end of the file basically, right before </body>
    md_block = lines[start_idx:len(lines)-3] # excluding </body>\n</html>\n
    
    # recreate file
    new_lines = lines[:view_analiza_end] + md_block + lines[view_analiza_end:start_idx] + lines[len(lines)-3:]
    
    with open("index.html", "w") as f:
        f.writelines(new_lines)
    print("Moved successfully.")
