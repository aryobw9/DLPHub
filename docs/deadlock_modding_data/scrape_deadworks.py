import urllib.request
import os
import sys
from bs4 import BeautifulSoup
from urllib.parse import urljoin

os.makedirs('scraped/deadworks', exist_ok=True)

base_url = 'https://docs.deadworks.net'

urls_to_visit = [
    '/',
    '/getting-started/developers',
    '/getting-started/developers/setup',
    '/getting-started/developers/first-plugin',
    '/getting-started/server-admins',
    '/getting-started/server-admins/run-a-server',
    '/getting-started/server-admins/run-a-server-docker',
    '/getting-started/server-admins/set-up-admins',
    '/getting-started/server-admins/install-plugins',
    '/getting-started/server-admins/custom-content',
    '/getting-started/server-admins/use-admin-tools',
    '/features/convars',
    '/features/zones',
    '/features/entity-io',
    '/features/permissions',
    '/features/game-state',
    '/features/particles',
    '/features/heroes',
    '/features/entities',
    '/features/timers',
    '/features/commands',
    '/features/chat',
    '/features/configuration',
    '/features/server',
    '/features/networking',
    '/features/modifiers',
    '/features/players',
    '/features/game-events',
    '/features/tracing',
    '/features/ui',
    '/features/precaching',
    '/features/sound',
    '/features/damage',
    '/features/world-text',
    '/features/abilities',
    '/guides/staff-roles',
    '/guides/admins-and-permissions',
    '/guides/uploading-content',
    '/api-reference',
]

visited = set()

while urls_to_visit:
    path = urls_to_visit.pop(0)
    if path in visited:
        continue
    visited.add(path)
    url = urljoin(base_url, path)
    
    clean_name = path.strip('/').replace('/', '__')
    if not clean_name:
        clean_name = 'index'
    outpath = os.path.join('scraped/deadworks', f'{clean_name}.txt')
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8')
        soup = BeautifulSoup(html, 'html.parser')
        
        # also find new doc links
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.startswith('/') and not href.startswith('/#') and not href.startswith('//'):
                clean_href = href.split('#')[0].rstrip('/')
                if clean_href and clean_href not in visited and clean_href not in urls_to_visit:
                    # check if relevant doc path
                    if any(clean_href.startswith(prefix) for prefix in ['/features', '/getting-started', '/guides', '/api']):
                        urls_to_visit.append(clean_href)
        
        main = soup.find('article') or soup.find('main') or soup.body
        text = main.get_text(separator='\n', strip=True) if main else ''
        title = soup.title.string if soup.title else clean_name
        
        with open(outpath, 'w', encoding='utf-8') as out:
            out.write(f"# {title}\nURL: {url}\n\n{text}")
        print(f"Deadworks: {clean_name} -> {len(text)} chars")
    except Exception as e:
        print(f"Error fetching {url}: {e}")
