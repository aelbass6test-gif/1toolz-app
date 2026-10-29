import urllib.request
import re
import json

with open('/tmp/flight_chunks.txt') as f:
    text = f.read()

js_urls = list(set(re.findall(r'https://files\.manuscdn\.com/webapp/_next/static/chunks/[a-zA-Z0-9_\-\.]+\.js', text)))
print(f'Total JS chunks: {len(js_urls)}')

endpoints = set()
for url in js_urls[:35]:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        content = urllib.request.urlopen(req, timeout=5).read().decode('utf-8', errors='ignore')
        for match in re.finditer(r'(/api/[a-zA-Z0-9_\-\/]+)', content):
            endpoints.add(match.group(1))
        for match in re.finditer(r'https://api\.manus\.im[a-zA-Z0-9_\-\/]*', content):
            endpoints.add(match.group(0))
        for match in re.finditer(r'(/v[0-9]/[a-zA-Z0-9_\-\/]+)', content):
            endpoints.add(match.group(1))
    except Exception as e:
        pass

print(f'Found endpoints ({len(endpoints)}):')
for ep in sorted(endpoints):
    print(ep)
