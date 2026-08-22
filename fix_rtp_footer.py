with open("app.js", "r") as f:
    content = f.read()

start = content.find("tableStates['analiza-rtp'].page = 1;")
end = content.find("renderTablePaginated('analiza-rtp');", start)

print(content[start-500:end+100])
