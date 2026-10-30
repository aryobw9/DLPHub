with open('ui/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

target = """          <div class="editor-filter-chips">
            <button type="button" class="editor-chip active" id="chip-filter-all" data-filter="all" onclick="setDrawerEditorFilter('all')">
              <span>همه</span> (<span class="tabular-num" id="count-all">348</span>)
            </button>
            <button type="button" class="editor-chip" id="chip-filter-differs" data-filter="differs" onclick="setDrawerEditorFilter('differs')">
              <span>متفاوت با بازی</span> (<span class="tabular-num" id="count-differs">46</span>)
            </button>
            <button type="button" class="editor-chip" id="chip-filter-overridden" data-filter="overridden" onclick="setDrawerEditorFilter('overridden')">
              <span>تغییر یافته توسط شما</span> (<span class="tabular-num" id="count-overridden">0</span>)
            </button>
          </div>"""

replacement = """          <div class="editor-filter-chips">
            <button type="button" class="editor-chip active" id="chip-filter-all" data-filter="all" onclick="setDrawerEditorFilter('all')">
              <span data-i18n="filterAll">All</span> (<span class="tabular-num" id="count-all">348</span>)
            </button>
            <button type="button" class="editor-chip" id="chip-filter-differs" data-filter="differs" onclick="setDrawerEditorFilter('differs')">
              <span data-i18n="filterDiffers">Differs</span> (<span class="tabular-num" id="count-differs">46</span>)
            </button>
            <button type="button" class="editor-chip" id="chip-filter-overridden" data-filter="overridden" onclick="setDrawerEditorFilter('overridden')">
              <span data-i18n="filterOverridden">Overridden</span> (<span class="tabular-num" id="count-overridden">0</span>)
            </button>
          </div>"""

if target in text:
    text = text.replace(target, replacement, 1)
    print("Updated filter chips (LF)")
elif target.replace('\n', '\r\n') in text:
    text = text.replace(target.replace('\n', '\r\n'), replacement.replace('\n', '\r\n'), 1)
    print("Updated filter chips (CRLF)")
else:
    print("Target not found!")

with open('ui/index.html', 'w', encoding='utf-8') as f:
    f.write(text)
