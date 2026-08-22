with open("app.js", "r") as f:
    content = f.read()
start = content.find("function renderTablePaginated")
end = content.find("function filterTable", start)
print(content[start:end])
