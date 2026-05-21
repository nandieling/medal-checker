import json, re

with open('PT_Debug_2026-05-21.json') as f:
    data = json.load(f)

# Sites to investigate: ptlgs, cspt, hxpt, luckpt, si-qi, dubhe
targets = {
    'ptlgs.org': None,
    'cspt.top': None,
    'si-qi.xyz': None,
    'dubhe.site': None,
    'pt.luckpt.de': None,
    'www.hxpt.org': None,
}

for p in data.get('pages', []):
    domain = p['url'].split('/')[2]
    if domain in targets and targets[domain] is None:
        targets[domain] = p['html']

for domain, html in targets.items():
    if html is None:
        print(f'\n=== {domain} NOT FOUND ===')
        continue
    
    print(f'\n=== {domain} ({len(html)} bytes) ===')
    
    # Find first medal-card
    card_re = re.search(r'<div[^>]*class=["][^"]*medal-card[^"]*"[^>]*>', html)
    if not card_re:
        print('  NO medal-card found')
        continue
    
    pos = card_re.start()
    depth = 0
    end = -1
    for i in range(pos, len(html)):
        if html[i] == '<':
            te = html.index('>', i)
            tag = html[i:te+1]
            if tag.startswith('<div ') or tag.startswith('<div>'):
                depth += 1
            elif tag.startswith('</div>'):
                depth -= 1
                if depth == 0:
                    end = te + 1
                    break
            i = te
    if end < 0:
        continue
    
    card_html = html[pos:end]
    print(f'  Card tag: {card_re.group(0)[:100]}')
    print(f'  Card size: {len(card_html)} bytes')
    
    # Find name
    for tag in ['div', 'h2', 'h3', 'span', 'a', 'strong', 'p']:
        m = re.search(f'<{tag}[^>]*class="[^"]*name[^"]*"[^>]*>([^<]*)</{tag}>', card_html)
        if m:
            print(f'  Name: <{tag}> = "{m.group(1)[:60]}"')
            break
    else:
        # Try img alt
        m = re.search(r'<img[^>]*alt="([^"]*)"[^>]*>', card_html)
        if m:
            print(f'  Name (img alt): "{m.group(1)[:60]}"')
        else:
            # Show what text is in the card
            text = re.sub(r'<[^>]+>', ' ', card_html)
            text = re.sub(r'\s+', ' ', text).strip()
            print(f'  Name: NOT FOUND. Card text preview: "{text[:100]}"')
    
    # Find buy buttons
    buy_btns = re.findall(r'<(?:input|button)[^>]*class="([^"]*buy[^"]*)"[^>]*>', card_html, re.I)
    if buy_btns:
        print(f'  Button class: {buy_btns}')
    
    # Field structure
    has_strong = '<strong>' in card_html
    has_detail_label = 'detail-label' in card_html
    has_detail_item = 'detail-item' in card_html
    
    print(f'  Fields: strong={has_strong} detail-label={has_detail_label} detail-item={has_detail_item}')
    
    # Show first 500 chars of card
    print(f'  HTML preview:')
    print(f'    {card_html[:400].replace(chr(10), " ")}')
    print(f'    ...')
    
    # Show field structure (what div classes contain field info)
    field_divs = re.findall(r'<div[^>]*class="([^"]*)"[^>]*>', card_html)
    for fd in field_divs[:10]:
        print(f'    field div: class="{fd}"')
    
    # Show specific field values
    labels = re.findall(r'<span[^>]*class="[^"]*label[^"]*"[^>]*>([^<]*)</span>', card_html)
    values = re.findall(r'<span[^>]*class="[^"]*value[^"]*"[^>]*>([^<]*)</span>', card_html)
    if labels:
        print(f'  label spans: {labels}')
    if values:
        print(f'  value spans: {values}')