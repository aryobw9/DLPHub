import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('ui/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('editor-filter-chips')
print(text[idx-50:idx+1000])
