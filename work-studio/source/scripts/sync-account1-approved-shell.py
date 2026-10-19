"""Copy the approved homepage shell verbatim; --check rejects future drift."""
from pathlib import Path
import re, sys

ROOT = Path(__file__).resolve().parents[1] / 'heavenly-key-website'
home = (ROOT / 'index.html').read_text()
def section(pattern, text):
    match = re.search(pattern, text, re.S)
    if not match: raise RuntimeError('Approved component missing: ' + pattern)
    return match.group()
header = section(r'<header class="site-header">.*?</header>', home)
footer = section(r'<section class="hk-share-bless".*?</footer>', home)
sharing = section(r'<script id="hk-share-to-bless-script"[^>]*>.*?</script>', home)
def absolute(match):
    attr, value = match.groups()
    if value.startswith(('https:', 'http:', '/', 'mailto:', 'tel:', 'data:')): return match.group()
    return attr + '="/' + value + '"'
header = re.sub(r'(href|src)="([^"]+)"', absolute, header)
header = header.replace('class="active" href="/#main" aria-current="page"', 'class="active" href="/#main"')
footer = re.sub(r'(href|src)="([^"]+)"', absolute, footer)
styles = []
for match in re.finditer(r'<style[^>]*>(.*?)</style>', home, re.S):
    if re.search(r'main-nav|hk-footer|hk-share|hk-community', match[1]): styles.append(match[1])
# Scope existing homepage styles to the approved components, never inner-page content.
scope = ':is(header.site-header,footer.site-footer,.hk-share-bless)'
def scoped(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'@import\s+url\([^)]*\)\s*;', '', css)
    output = ''; start = 0
    while start < len(css):
        opening = css.find('{', start)
        if opening < 0: break
        depth = 1; end = opening + 1
        while depth and end < len(css):
            if css[end] == '{': depth += 1
            elif css[end] == '}': depth -= 1
            end += 1
        selector = css[start:opening].strip(); body = css[opening+1:end-1]
        if selector.startswith(('@media', '@supports')): output += selector+'{'+scoped(body)+'}'
        elif selector.startswith('@keyframes'): output += selector+'{'+body+'}'
        elif selector == ':root': output += scope+'{'+body+'}'
        elif selector == 'body': output += scope+'{'+body+'}'
        elif not selector.startswith('@'):
            if 'hk-primary-footer' in selector:
                body = ';'.join(d+'!important' if d.strip().startswith('padding') and '!important' not in d else d for d in body.split(';'))
            selectors = re.split(r',(?=(?:[^()]*\([^()]*\))*[^()]*$)', selector)
            selectors = [s for s in selectors if re.match(r'^(?:[*.]|h[1-6]\b|p\b|a\b|button\b|summary\b|img\b|figure\b|blockquote\b)', s.strip()) and (not s.strip().startswith('.') or re.match(r'^\.(?:wrap|site-header|header-inner|header-swoosh|brand|main-nav|dropdown|nav-toggle|site-footer|hk-footer|copyright|social|hk-community|hk-share)',s.strip()))]
            if not selectors: start=end;continue
            def protect(s, tier=0):
                match = re.search(r'(::[A-Za-z-]+|:(?:before|after))$', s.strip())
                pseudo = match.group() if match else ''
                base = s.strip()[:-len(pseudo)] if pseudo else s.strip()
                guard = ':is('+('#hk-shell-priority'*tier+', ' if tier else '')+scope+','+scope+' *)'
                return ':is('+base+')'+guard+pseudo
            if re.search(r'main-nav|nav-toggle|header-inner|header-swoosh|\.brand|^\.site-header$',selector):
                normal = [d+'!important' for d in body.split(';') if d.strip() and '!important' not in d]
                important = [d for d in body.split(';') if '!important' in d]
                if normal: output += ','.join(protect(s,1) for s in selectors)+'{'+(';'.join(normal))+'}'
                if important: output += ','.join(protect(s,2) for s in selectors)+'{'+(';'.join(important))+'}'
            else: output += ','.join(protect(s) for s in selectors)+'{'+body+'}'
        start = end
    return output
cssfiles = ['home-renewal.css','premium-navigation-upgrade.css','resources-dropdown-fix.css','footer-five-columns.css','footer-approved-cleanup.css']
font_import = re.search(r'@import\s+url\([^)]*\)\s*;', (ROOT/'css/home-renewal.css').read_text()).group()
css = font_import + '\n/* Generated only from the approved homepage. Do not hand-edit. */\n.site-header .main-nav{position:static!important;inset:auto!important;transform:none!important;transition:none!important;padding:0!important;margin:0!important;border:0!important;box-shadow:none!important;background:transparent!important;overflow:visible!important}.site-header .main-nav li{width:auto!important;min-width:0!important;max-width:none!important;margin:0!important;padding:0!important;list-style:none!important;transform:none!important}\n' + ''.join(scoped((ROOT/'css'/p).read_text()) for p in cssfiles) + ''.join(scoped(s) for s in styles)
css = css.replace("url('../assets/", "url('/assets/")

css += '\nheader.site-header .wrap,footer.site-footer .wrap,.hk-share-bless .wrap{padding:0;max-width:none;background:none}header.site-header.site-header{color:var(--ink,#111)}header.site-header.site-header,footer.site-footer.site-footer{padding:0;margin:0;border:0;text-align:start}header.site-header .brand img{filter:none!important}\n'
changed=[]
def save(path, text):
    previous = path.read_text() if path.exists() else ''
    if previous != text:
        changed.append(str(path.relative_to(ROOT.parent)))
        if '--check' not in sys.argv: path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text)
save(ROOT/'css/approved-home-shell.css',css)
for page in [*sorted((ROOT/'pages').glob('*.html')), ROOT/'live/index.html']:
    if page.name == 'admin.html': continue
    text = page.read_text()
    if not re.search(r'<header\b',text) or not re.search(r'<footer\b',text): continue
    text = re.sub(r'<header\b[^>]*>.*?</header>', lambda _:header, text, count=1, flags=re.S)
    text = re.sub(r'(?:<section class="hk-share-bless".*?</section>)?\s*<footer\b[^>]*>.*?</footer>',lambda _:footer,text,count=1,flags=re.S)
    text = re.sub(r'<script\b[^>]*src="[^"]*(?:hk-standard-footer|site-footer|approved-global-footer|floating-radio|public-site-master|approved-widget-system|online-assistant|home-renewal)\.js[^"]*"[^>]*>\s*</script>','',text)
    text = re.sub(r'<link\b[^>]*href="[^"]*approved-home-shell\.css[^"]*"[^>]*>','',text)
    text = re.sub(r'<script id="hk-share-to-bless-script"[^>]*>.*?</script>','',text,flags=re.S)
    text = re.sub(r'<script\b[^>]*src="[^"]*app-update\.js[^"]*"[^>]*>\s*</script>','',text)
    text = text.replace('<head>','<head><script src="/js/app-update.js?v=20261018f"></script>',1)
    text = text.replace('</head>','<link rel="stylesheet" href="/css/approved-home-shell.css?v=20261018f"></head>')
    if page.name in ['radio.html','terms.html','privacy.html','i-said-yes.html','grdpc.html'] and 'src="/js/cms-runtime-20261015.js' not in text:
        text = text.replace('</body>','<link rel="stylesheet" href="/js/cms-runtime-20261015.css"><script defer src="/js/cms-runtime-20261015.js?v=20261018f"></script></body>')
    text = re.sub(r'(/js/cms-runtime-20261015\.js)(?:\?[^"<>]*)?',r'\1?v=20261018f',text)
    text = text.replace('</body>',sharing+'<script defer src="/js/public-site-master.js?v=20261018f"></script></body>')
    save(page,text)
if changed and '--check' in sys.argv: print('Approved shell drift: '+', '.join(changed));sys.exit(1)
print('Approved homepage menu/footer: '+('consistent' if not changed else str(len(changed))+' files synchronized'))
