import re
import os

def parse_gameinfo(filepath):
    convars = {}
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        in_convars = False
        for line in f:
            stripped = line.strip()
            if '"ConVars"' in stripped or 'ConVars' in stripped:
                in_convars = True
                continue
            if in_convars:
                if stripped.startswith('//') or not stripped:
                    continue
                if stripped == '{':
                    continue
                if stripped == '}':
                    break
                m = re.match(r'\"?([a-zA-Z0-9_\.]+)\"?\s+\"?([^\"]*)\"?', stripped)
                if m:
                    convars[m.group(1)] = m.group(2)
    return convars

our_t1 = parse_gameinfo(r'D:\Claude\DeadlockConfigs\t1\gameinfo.gi')
our_t2 = parse_gameinfo(r'D:\Claude\DeadlockConfigs\t2\gameinfo.gi')
our_t3 = parse_gameinfo(r'D:\Claude\DeadlockConfigs\t3\gameinfo.gi')
new_4 = parse_gameinfo(r'C:\Users\Aryo\Downloads\gameinfo (4).gi')
new_3 = parse_gameinfo(r'C:\Users\Aryo\Downloads\gameinfo (3).gi')

print("="*60)
print("1. NEW gameinfo (4).gi vs OUR CURRENT T1 (D:\\Claude\\DeadlockConfigs\\t1\\gameinfo.gi)")
print("="*60)
print(f"Total ConVars: OUR T1 = {len(our_t1)}, NEW (4) = {len(new_4)}")
added_4 = {k: new_4[k] for k in new_4 if k not in our_t1}
removed_4 = {k: our_t1[k] for k in our_t1 if k not in new_4}
changed_4 = {k: (our_t1[k], new_4[k]) for k in new_4 if k in our_t1 and our_t1[k] != new_4[k]}

print(f"\n[+] Added in (4) ({len(added_4)}):")
for k, v in added_4.items():
    print(f"    + {k} = {v}")

print(f"\n[-] Removed in (4) ({len(removed_4)}):")
for k, v in removed_4.items():
    print(f"    - {k} (was {v})")

print(f"\n[*] Changed value in (4) ({len(changed_4)}):")
for k, (old_v, new_v) in changed_4.items():
    print(f"    * {k}: {old_v} -> {new_v}")

print("\n" + "="*60)
print("2. NEW gameinfo (3).gi vs OUR CURRENT T2 (D:\\Claude\\DeadlockConfigs\\t2\\gameinfo.gi)")
print("="*60)
print(f"Total ConVars: OUR T2 = {len(our_t2)}, NEW (3) = {len(new_3)}")
added_3 = {k: new_3[k] for k in new_3 if k not in our_t2}
removed_3 = {k: our_t2[k] for k in our_t2 if k not in new_3}
changed_3 = {k: (our_t2[k], new_3[k]) for k in new_3 if k in our_t2 and our_t2[k] != new_3[k]}

print(f"\n[+] Present in (3) but NOT in OUR T2 ({len(added_3)}):")
for k, v in added_3.items():
    print(f"    + {k} = {v}")

print(f"\n[-] In OUR T2 but MISSING in (3) ({len(removed_3)}):")
# Let's categorize them or print all
for k, v in sorted(removed_3.items()):
    print(f"    - {k} = {v}")

print(f"\n[*] Changed value in (3) vs OUR T2 ({len(changed_3)}):")
for k, (old_v, new_v) in changed_3.items():
    print(f"    * {k}: OUR T2 had '{old_v}' -> NEW (3) has '{new_v}'")

print("\n" + "="*60)
print("3. WHAT WERE THE DIFFERENCES BETWEEN OUR OWN T1 AND T2?")
print("="*60)
diff_our_1_2 = {k: (our_t1[k], our_t2[k]) for k in our_t1 if k in our_t2 and our_t1[k] != our_t2[k]}
print("Differences between our own T1 and T2:")
for k, (v1, v2) in diff_our_1_2.items():
    print(f"    * {k}: T1='{v1}' vs T2='{v2}'")
print(f"Keys in our T1 not in our T2: {[k for k in our_t1 if k not in our_t2]}")
print(f"Keys in our T2 not in our T1: {[k for k in our_t2 if k not in our_t1]}")
