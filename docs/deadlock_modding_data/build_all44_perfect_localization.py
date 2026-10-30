# -*- coding: utf-8 -*-
"""
Perfect Hero Localization Builder for Deadlock.
Resolves:
1. Inverted parentheses bug in hero tooltips and tier upgrades.
2. Backwards text bug in tier upgrade cards (Damage, Movement Speed, Cooldown, etc.).
3. Panorama UI layout breaking bug caused by <Panel> icon tags in descriptions.
"""

import os
import re
import json
import shutil
import subprocess

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BATCH_DIR = os.path.join(BASE_DIR, "localization_batches")
VANILLA_HEROES_TXT = r"D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\resource\localization\citadel_heroes\citadel_heroes_english.txt"
CUSTOM_HEROES_TXT = r"D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\resource\localization\citadel_heroes\citadel_heroes_english.txt"
DOWNLOADS_VPK = r"C:\Users\Aryo\Downloads\pak82_dir (1).vpk"
CUSTOM_VPK = r"D:\SteamLibrary\steamapps\common\Deadlock\game\citadel\custom\pak82_dir.vpk"
VPKEDIT_CLI = r"d:\Claude\Modding\Deadlock\tools\vpkedit\vpkeditcli.exe"

terms_to_nbsp = [
    "Bonus Spirit Damage", "Bonus Weapon Damage", "Bonus Move Speed", "Bonus Fire Rate",
    "Invis Move Speed", "Invis Sprint Speed", "Fly Speed", "Debuff Resistance", "Debuff Resist",
    "Bullet Resist", "Spirit Resist", "Spirit Resistance", "Heavy Melee", "Light Melee", "Melee Attack",
    "Bullet Lifesteal", "Spirit Lifesteal", "Melee Lifesteal", "Base Health", "Max Health",
    "Max HP", "Health Regen", "Air Jump", "Air Dash", "Split Shot", "Active Reload",
    "Cooldown Reduction", "Healing Reduction", "Slow Resistance", "Movement Slow",
    "Spirit Amp", "Glass Cannon", "Shadow Weave", "Magic Carpet", "Soul Rebirth",
    "Cheat Death", "Metal Skin", "Return Fire", "Torment Pulse", "Mystic Burst",
    "Mystic Reverb", "Toxic Bullets", "Spiritual Overflow", "Close Quarters", "Long Range",
    "Mystic Shot", "Ethereal Bullets", "Restorative Shot", "Point Blank",
    "Headshot Booster", "Soul Shredder", "Hollow Point", "Pristine Emblem",
    "Fire Rate", "Spirit Power", "Melee Damage", "Weapon Damage", "Spirit Damage",
    "Bullet Damage", "Move Speed", "Sprint Speed", "Cast Range", "Stun Duration",
    "Sleep Duration", "Debuff Duration", "Bullet Armor", "Spirit Armor", "Bullet Evasion",
    "Ground Strike", "Death Slam", "High Explosive", "Serrated Knives", "Killing Blow",
    "Static Charge", "Storm Cloud", "Lightning Strike", "Power Surge", "Lightning Ball",
    "Frozen Shelter", "Flame Dash", "Time Wall", "Kinetic Carbine", "Quantum Entanglement",
    "Card Toss", "Psychic Lift", "Shadow Form", "Flying Strike", "Power Slash", "Crimson Slash",
    "Tether Duration", "Capture Radius", "Impact Damage", "Burn Damage", "Charge Time",
    "Spirit Scaling", "Incoming Healing", "Bleed Damage", "Fading Move Speed", "Hero Headshots",
    "NPC Headshots", "Pulse Damage", "Damage Amp", "Ability Charges", "Combat Barrier"
]

def format_hero_token(key, val):
    if not val:
        return val

    is_tier_upgrade = bool(re.search(r"_t[123]_desc$", key))

    # 1. Strip buggy <Panel class="AbilityPropertyIcon..."> tags
    val = re.sub(r'<Panel\s+class=\\*["\']AbilityPropertyIcon [^"\'\\]+\\*["\']>\s*', '', val)
    val = re.sub(r'</Panel>', '', val)

    # 2. Normalize class attributes: <tag class="foo"> -> <tag class=\"foo\">
    val = re.sub(r'<([a-zA-Z0-9]+)\s+class=\\*["\']([^"\'\\]+)\\*["\']>', r'<\1 class=\\"\2\\">', val)

    # 3. Clean clumsy parenthesized English terms in tier upgrades
    if is_tier_upgrade:
        # Stake T3 clean formatting (matches Tier 1 and Tier 2 cards exactly)
        if key == "citadel_ability_hornet_chain_t3_desc":
            val = '<span class=\\"highlight\\">+{s:ChainDuration}s</span> Tether Duration<br><span class=\\"highlight\\">+{s:CaptureRadius}m</span> Capture Radius'
        elif key == "ability_crackshot_t1_desc":
            val = '<span class=\\"highlight\\">-{s:FadingSlowPercent}%</span> Fading Move Speed'
        elif key == "ability_crackshot_t2_desc":
            val = '<span class=\\"highlight\\">+{s:Damage}</span> Damage<br><span class=\\"highlight\\">{s:BulletResistReduction}%</span> Bullet Resist ({s:BulletResistReductionDuration}s)'
        elif key == "ability_crackshot_t3_desc":
            val = '<span class=\\"highlight\\">{s:AbilityCooldownPerHeadshot}s</span> Cooldown on Hero Headshots<br>{s:AbilityCooldownPerHeadshotNPC}s on NPC Headshots'
        else:
            # Strip redundant parenthesized translations in tier upgrades
            val = val.replace("(Tether Duration)", "").replace("(Unlimited Ammo)", "").replace("(Invulnerability)", "")
            val = val.replace("(Max HP)", "").replace("(Fear)", "").replace("(Full Rage)", "")
            val = val.replace("(Blessed)", "").replace("(Execute)", "").replace("(Checkmate)", "")
            val = re.sub(r"\s{2,}", " ", val).strip()

    # 4. Handle parentheses in general text:
    # Wrap English inside parentheses in \u202A(English)\u202C to prevent BiDi mirroring inversion
    def wrap_paren(m):
        inner = m.group(1).strip()
        if re.search(r"[a-zA-Z0-9]", inner) and not re.search(r"[\u0600-\u06FF]", inner):
            return f"\u202A({inner})\u202C"
        return m.group(0)

    # Remove any corrupted \u200F around parentheses
    val = re.sub(r'\u200F*\(\u200F*', '(', val)
    val = re.sub(r'\u200F*\)\u200F*', ')', val)
    val = re.sub(r'\(([^)]+)\)', wrap_paren, val)

    # 5. Multi-word technical terms to NBSP
    for term in terms_to_nbsp:
        nbsp_term = term.replace(" ", "\u00A0")
        val = val.replace(term, nbsp_term)

    # 6. Pad and isolate inline attributes and keybinds
    def replace_inline_tag(m):
        tag = m.group(0)
        return f"\u00A0\u00A0\u202A{tag}\u202C\u200F"

    val = re.sub(r"(?<!\u202A)\{g:(?:citadel_inline_attribute|citadel_binding):[^\}]+\}(?!\u202C)", replace_inline_tag, val)

    # 7. Wrap English-only highlight spans in LRE / PDF + RLM (for narrative text only)
    def wrap_highlight_spans(m):
        cls_name = m.group(1)
        inner = m.group(2)
        if re.search(r"[a-zA-Z0-9]", inner) and not re.search(r"[\u0600-\u06FF]", inner):
            return f"\u202A<span class=\\\"{cls_name}\\\">{inner}</span>\u202C\u200F"
        return m.group(0)

    if not is_tier_upgrade:
        val = re.sub(r'(?<!\u202A)<span class=\\"(highlight[a-zA-Z0-9_-]*)\\">([^<]+)</span>(?!\u202C)', wrap_highlight_spans, val)

    # 8. Handling newlines and diminish
    if not is_tier_upgrade:
        val = re.sub(r"(<br\s*/?>)+(?!\u200F)", lambda m: m.group(0) + "\u200F", val)
        val = re.sub(r'(<span class=\\"diminish\\">)(?!\u200F)', lambda m: m.group(1) + "\u200F", val)

    # 9. Clean redundant characters
    val = re.sub(r'\u200F{2,}', '\u200F', val)
    val = re.sub(r'\u202A{2,}', '\u202A', val)
    val = re.sub(r'\u202C{2,}', '\u202C', val)
    val = re.sub(r'\u00A0{3,}', '\u00A0\u00A0', val)

    # 10. Leading RLM:
    # NEVER apply leading \u200F to tier upgrades! Tier upgrades must remain LTR so numbers stay on the left.
    if is_tier_upgrade:
        val = val.lstrip("\u200F")
    else:
        if re.search(r"[\u0600-\u06FF]", val) and not val.startswith("\u200F"):
            val = "\u200F" + val

    return val

def main():
    print("--- 1. Merging accurate translation batches ---")
    merged_translations = {}
    for batch_id in [1, 2, 3, 4, "5_extra"]:
        batch_path = os.path.join(BATCH_DIR, f"accurate_batch{batch_id}.json")
        with open(batch_path, "r", encoding="utf-8") as f:
            batch_data = json.load(f)
            merged_translations.update(batch_data)

    print(f"Total merged tokens: {len(merged_translations)}")

    print("--- 2. Applying precision formatting & BiDi fixes ---")
    formatted_translations = {}
    for k, v in merged_translations.items():
        formatted_translations[k] = format_hero_token(k, v)

    print("--- 3. Reading vanilla citadel_heroes_english.txt ---")
    with open(VANILLA_HEROES_TXT, "r", encoding="utf-8-sig") as f:
        vanilla_lines = f.readlines()

    token_re = re.compile(r'^(\s*\"([^\"]+)\"\s+\")(.*)(\"\s*)$')
    out_lines = []
    replaced_count = 0
    used_keys = set()
    closing_bracket_idx = -1

    for line in vanilla_lines:
        m = token_re.match(line)
        if m:
            prefix = m.group(1)
            key = m.group(2)
            val = m.group(3)
            suffix = m.group(4)

            if key in formatted_translations:
                new_val = formatted_translations[key]
                replaced_count += 1
                used_keys.add(key)
                out_lines.append(f"{prefix}{new_val}{suffix}")
            else:
                out_lines.append(line)
        else:
            if line.strip() == "}":
                closing_bracket_idx = len(out_lines)
            out_lines.append(line)

    print(f"Replaced in-place vanilla tokens: {replaced_count}")

    # Append any remaining tokens (extra hero-labs tokens)
    extra_keys = set(formatted_translations.keys()) - used_keys
    print(f"Extra tokens to append: {len(extra_keys)}")

    if extra_keys:
        extra_lines = ["\n\t\t//-----------------------------------------------------------------------------\n",
                       "\t\t// Extra / Hero-Labs Persian Localized Tokens\n",
                       "\t\t//-----------------------------------------------------------------------------\n"]
        for k in sorted(extra_keys):
            extra_lines.append(f'\t\t"{k}"\t\t\t\t"{formatted_translations[k]}"\n')

        if closing_bracket_idx != -1:
            out_lines = out_lines[:closing_bracket_idx] + extra_lines + out_lines[closing_bracket_idx:]
        else:
            out_lines.extend(extra_lines)

    # Save to fixed file
    fixed_path = os.path.join(BASE_DIR, "citadel_heroes_english_fixed.txt")
    with open(fixed_path, "w", encoding="utf-8-sig") as f:
        f.writelines(out_lines)
    print(f"Saved fixed file to {fixed_path} ({len(out_lines)} lines)")

    # Deploy to custom loose directory
    os.makedirs(os.path.dirname(CUSTOM_HEROES_TXT), exist_ok=True)
    shutil.copy2(fixed_path, CUSTOM_HEROES_TXT)
    # Also copy to custom VPK if VPK exists and game is closed
    if os.path.exists(DOWNLOADS_VPK):
        try:
            shutil.copy2(DOWNLOADS_VPK, CUSTOM_VPK)
            print(f"Successfully updated custom VPK: {CUSTOM_VPK}")
        except PermissionError:
            print(f"Notice: {CUSTOM_VPK} is locked by Deadlock. Loose files in custom/ take precedence.")
        except Exception as e:
            print(f"Notice updating VPK: {e}")

if __name__ == "__main__":
    main()
