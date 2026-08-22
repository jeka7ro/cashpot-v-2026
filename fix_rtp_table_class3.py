with open("app.js", "r") as f:
    content = f.read()

start = content.find('renderTablePaginated(\'analiza-rtp\');')
if start != -1:
    print("Found renderTablePaginated('analiza-rtp')")
