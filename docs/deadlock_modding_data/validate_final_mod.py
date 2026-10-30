import sys, re
sys.stdout.reconfigure(encoding='utf-8')

target_file = r'D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\resource\localization\citadel_heroes\citadel_heroes_english.txt'

with open(target_file, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

errors = []
tokens_found = 0
persian_tokens = 0

token_re = re.compile(r'^\s*"([^"]+)"\s*"(.*)"\s*$')

for idx, line in enumerate(lines, 1):
    stripped = line.strip()
    if not stripped or stripped.startswith('//') or stripped in ['{', '}', '"lang"', '"Language"', '"Tokens"']:
        continue
    
    m = token_re.match(line)
    if not m:
        # Check if line is malformed token
        if line.strip().startswith('"'):
            errors.append((idx, f"Malformed token line: {line.strip()[:80]}"))
    else:
        tokens_found += 1
        key = m.group(1)
        val = m.group(2)
        
        # Check for unescaped double quotes inside value
        # In VDF, an unescaped double quote would have caused the regex to match incorrectly or truncated
        # Check if val has odd number of backslashes before a quote:
        # e.g. <span class=\"highlight\">
        if '<span' in val and 'class=' in val:
            if not ('class=\\"highlight\\"' in val or 'class=\\"diminish\\"' in val or 'class=\\"highlight_spirit\\"' in val or 'class=\\"italics\\"' in val):
                errors.append((idx, f"Suspicious span class format in {key}: {val[:80]}"))
        
        # Check if Persian
        if re.search(r'[\u0600-\u06FF]', val):
            persian_tokens += 1
            is_tier = bool(re.search(r"_t[123]_desc$", key))
            # Tier upgrades intentionally do NOT start with RLM so numbers stay LTR on the left
            if not is_tier and not val.startswith('\u200F'):
                errors.append((idx, f"Persian token without leading RLM in {key}"))

print(f"Validation finished.")
print(f"Total valid tokens: {tokens_found}")
print(f"Total Persian tokens: {persian_tokens}")
print(f"Total errors/warnings: {len(errors)}")

if errors:
    print("Top 10 errors:")
    for err in errors[:10]:
        print(" ", err)
else:
    print("SUCCESS: 0 syntax errors or malformed tokens found!")
