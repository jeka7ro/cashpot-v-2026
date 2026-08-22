with open("index.html", "r") as f:
    content = f.read()

start = content.find('<!-- Locatii -->')
end = content.find('</div>\n        \n\n\n\n</div>\n      </div>\n      </div>\n\n      <!-- Optimizare Sală -->')
html = content[start:end]

# User wants pagination inside the table container (class="table-container") like the "Performanță Reset" page.
# Right now, <div id="pg-md-loc" class="pagination-container" style="padding:12px 20px;"></div> is outside of table-container.

# We will move it inside table-container, right after </table>.
# Same for pg-md-res and pg-md-pay.

new_html = html.replace(
    '</table>\n            </div>\n            <div id="pg-md-loc"',
    '</table>\n            <div id="pg-md-loc"'
)

new_html = new_html.replace(
    '            <div id="pg-md-loc" class="pagination-container" style="padding:12px 20px;"></div>\n        </div>',
    '            <div id="pg-md-loc" class="pagination-container" style="padding:12px 20px;"></div>\n            </div>\n        </div>'
)

new_html = new_html.replace(
    '</table>\n            </div>\n            <div id="pg-md-res"',
    '</table>\n            <div id="pg-md-res"'
)

new_html = new_html.replace(
    '            <div id="pg-md-res" class="pagination-container" style="padding:12px 20px;"></div>\n        </div>',
    '            <div id="pg-md-res" class="pagination-container" style="padding:12px 20px;"></div>\n            </div>\n        </div>'
)

new_html = new_html.replace(
    '</table>\n            </div>\n            <div id="pg-md-pay"',
    '</table>\n            <div id="pg-md-pay"'
)

new_html = new_html.replace(
    '            <div id="pg-md-pay" class="pagination-container" style="padding:12px 20px;"></div>\n        </div>',
    '            <div id="pg-md-pay" class="pagination-container" style="padding:12px 20px;"></div>\n            </div>\n        </div>'
)

content = content[:start] + new_html + content[end:]
with open("index.html", "w") as f:
    f.write(content)

print("Moved pagination inside container")
