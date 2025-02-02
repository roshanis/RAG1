#!/usr/bin/env python
#Converts all files in the current directory to markdown using Microsoft's markitdown
import sys
from markitdown import MarkItDown

if len(sys.argv) < 2:
    sys.exit("Usage: python convert_to_md.py <file_path>")

file_path = sys.argv[1]
md = MarkItDown()
result = md.convert(file_path)
print(result.text_content) 