import re
with open("app.js", "r") as f:
    content = f.read()

start = content.find('window.filterRtpTable = function() {')
if start != -1:
    end = content.find('renderTablePaginated(\'analiza-rtp\');', start)
    func = content[start:end+50]
    print(func)
