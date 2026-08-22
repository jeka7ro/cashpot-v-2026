with open("app.js", "r") as f:
    content = f.read()

start = content.find('function renderTablePaginated(key) {')
end = content.find('}', start + 500)
print(content[start:end])
