with open("index.html", "r") as f:
    content = f.read()

start = content.find('<!-- Filter Header -->')
end = content.find('<div class="table-container"', start)

print(content[start:end])
