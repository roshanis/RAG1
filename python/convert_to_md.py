#!/usr/bin/env python

import sys
from markitdown import MarkItDown

if len(sys.argv) < 2:
    sys.exit("Usage: python convert_to_md.py <file_path>")

file_path = sys.argv[1]
md = MarkItDown()
result = md.convert(file_path)
print(result.text_content) 