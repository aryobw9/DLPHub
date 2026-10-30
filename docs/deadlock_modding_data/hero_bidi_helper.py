# -*- coding: utf-8 -*-
"""
Hero Abilities Persian Localization Helper for Deadlock.
Applies professional gaming style and BiDi/RTL formatting rules.
"""

import re

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

def format_bidi(val):
    if not val:
        return val

    # 1. Normalize class attributes on any tag: <tag class="foo"> -> <tag class=\"foo\">
    val = re.sub(r'<([a-zA-Z0-9]+)\s+class=\\*["\']([^"\'\\]+)\\*["\']>', r'<\1 class=\\"\2\\">', val)

    # 2. Replace multi-word English terms with NBSP
    for term in terms_to_nbsp:
        nbsp_term = term.replace(" ", "\u00A0")
        val = val.replace(term, nbsp_term)

    # 3. Pad and isolate inline attributes and keybinds
    def replace_inline_tag(m):
        tag = m.group(0)
        return f"\u00A0\u00A0\u202A{tag}\u202C\u200F"

    # Only replace if not already wrapped
    val = re.sub(r"(?<!\u202A)\{g:(?:citadel_inline_attribute|citadel_binding):[^\}]+\}(?!\u202C)", replace_inline_tag, val)

    # 4. Wrap English-only highlight/special spans in LRE / PDF + RLM
    def wrap_highlight_spans(m):
        cls_name = m.group(1)
        inner = m.group(2)
        # If contains Latin/numbers and NO Persian
        if re.search(r"[a-zA-Z0-9]", inner) and not re.search(r"[\u0600-\u06FF]", inner):
            return f"\u202A<span class=\\\"{cls_name}\\\">{inner}</span>\u202C\u200F"
        return m.group(0)

    val = re.sub(r'(?<!\u202A)<span class=\\"(highlight[a-zA-Z0-9_-]*)\\">([^<]+)</span>(?!\u202C)', wrap_highlight_spans, val)

    # 5. Wrap standalone English words or codes inside parentheses
    val = re.sub(r'(?<!\u200F)\(', '\u200F(\u200F', val)
    val = re.sub(r'\)(?!\u200F)', '\u200F)\u200F', val)

    # 6. Handle <br> tags: ensure newlines start with \u200F (RLM)
    val = re.sub(r"(<br\s*/?>)+(?!\u200F)", lambda m: m.group(0) + "\u200F", val)

    # 7. Handle <span class="diminish">: ensure diminish blocks start with \u200F
    val = re.sub(r'(<span class=\\"diminish\\">)(?!\u200F)', lambda m: m.group(1) + "\u200F", val)

    # 8. Clean redundant duplicates
    val = re.sub(r'\u200F{2,}', '\u200F', val)
    val = re.sub(r'\u202A{2,}', '\u202A', val)
    val = re.sub(r'\u202C{2,}', '\u202C', val)
    val = re.sub(r'\u00A0{3,}', '\u00A0\u00A0', val)

    # 9. Ensure the entire token value starts with \u200F (RLM)
    if not val.startswith("\u200F"):
        val = "\u200F" + val

    return val
