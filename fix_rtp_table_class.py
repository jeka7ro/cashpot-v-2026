with open("index.html", "r") as f:
    content = f.read()

start = content.find('<table class="data-table w-full" id="table-analiza-rtp">')
if start != -1:
    new_html = content.replace(
        '<table class="data-table w-full" id="table-analiza-rtp">',
        '<table class="data-table" id="analiza-rtp-tbl">'
    )
    with open("index.html", "w") as f:
        f.write(new_html)
    print("Fixed table id to analiza-rtp-tbl")
