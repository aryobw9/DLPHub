import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('ui/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderConvarEditor')
print(text[idx:idx+4500])
