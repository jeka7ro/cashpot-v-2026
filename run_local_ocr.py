import fitz
from PIL import Image
import io
import subprocess
import os

pdf_file = "./Craiova/Contract de închiriere.pdf"
doc = fitz.open(pdf_file)
page = doc.load_page(0)
pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
img_path = "/tmp/ocr_test.png"
pix.save(img_path)

result = subprocess.run(["swift", "mac_ocr.swift", img_path], capture_output=True, text=True)
print("--- OCR RESULT ---")
print(result.stdout)
