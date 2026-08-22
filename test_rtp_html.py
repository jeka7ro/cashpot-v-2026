with open("index.html", "r") as f:
    content = f.read()

start = content.find('<div id="analiza-rtp"')
if start != -1:
    end = content.find('</div>\n      </div>\n\n      <!-- Performanță Reset -->')
    print("Found RTP div!")
