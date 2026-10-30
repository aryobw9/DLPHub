import urllib.request
import os
import json
import sys
from bs4 import BeautifulSoup

os.makedirs('scraped/deadlockmodding', exist_ok=True)

req = urllib.request.Request('https://deadlockmodding.pages.dev/static/contentIndex.json', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    index_data = json.loads(resp.read().decode('utf-8'))

for slug, meta in index_data.items():
    url = f'https://deadlockmodding.pages.dev/{slug}'
    filename = slug.replace('/', '__') + '.txt'
    outpath = os.path.join('scraped/deadlockmodding', filename)
    try:
        r = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(r) as response:
            html = response.read().decode('utf-8')
        soup = BeautifulSoup(html, 'html.parser')
        article = soup.find('article') or soup.find('main') or soup.body
        text = article.get_text(separator='\n', strip=True) if article else ''
        title = meta.get('title', slug)
        with open(outpath, 'w', encoding='utf-8') as out:
            out.write(f"# {title}\nURL: {url}\n\n{text}")
        print(f"Fetched {slug} -> {len(text)} chars")
    except Exception as e:
        print(f"Error fetching {slug}: {e}")
