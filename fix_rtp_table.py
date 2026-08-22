with open("index.html", "r") as f:
    content = f.read()

start = content.find('<th style="text-align:center;">Zile ⇅</th>')
if start != -1:
    end = content.find('</tr>', start)
    # the issue is that "Zile" is added in HTML but not in JS!
    print("Found HTML headers!")
