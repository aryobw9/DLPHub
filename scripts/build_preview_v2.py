import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Read index.html (which is now the master actual app UI)
with open('d:/Claude/DLPBooster/ui/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Make sure preview-v2 matches index.html
with open('d:/Claude/DLPBooster/ui/preview-v2.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("preview-v2.html successfully synchronized with ui/index.html!")
