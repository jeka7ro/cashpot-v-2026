import fitz
import pytesseract
from PIL import Image
import io

f = "./Craiova/Contract de închiriere.pdf"
doc = fitz.open(f)
text = ""
for i in range(min(2, len(doc))):
    page = doc.load_page(i)
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    try:
        text += pytesseract.image_to_string(img, lang="ron") + "\n"
    except Exception as e:
        print(f"Tesseract error: {e}")
print(text)
