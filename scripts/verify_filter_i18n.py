import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('ui/i18n/en.js', 'r', encoding='utf-8') as f:
    en = f.read()
with open('ui/i18n/fa.js', 'r', encoding='utf-8') as f:
    fa = f.read()

import re
print("EN filterAll:", re.findall(r'filterAll\s*:\s*"[^"]+"', en))
print("EN filterDiffers:", re.findall(r'filterDiffers\s*:\s*"[^"]+"', en))
print("EN filterOverridden:", re.findall(r'filterOverridden\s*:\s*"[^"]+"', en))
print("FA filterAll:", re.findall(r'filterAll\s*:\s*"[^"]+"', fa))
print("FA filterDiffers:", re.findall(r'filterDiffers\s*:\s*"[^"]+"', fa))
print("FA filterOverridden:", re.findall(r'filterOverridden\s*:\s*"[^"]+"', fa))
