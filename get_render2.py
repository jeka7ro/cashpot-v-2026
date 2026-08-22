with open("app.js", "r") as f:
    content = f.read()
start = content.find("function renderTablePaginated")
end = content.find("if (key === 'analiza-resets')", start)
print(content[start:end])
