"""Assemble dist/ into a single HTML fragment for publishing as a claude.ai Artifact."""
import pathlib, re, sys

dist = pathlib.Path(sys.argv[1])
html = (dist / 'index.html').read_text(encoding='utf-8')
css = ''.join(p.read_text(encoding='utf-8') for p in (dist / 'assets').glob('*.css'))
js = ''.join(p.read_text(encoding='utf-8') for p in (dist / 'assets').glob('*.js'))
fonts = '\n'.join(re.findall(r'<link[^>]+fonts\.(?:googleapis|gstatic)[^>]*>', html))
title = re.search(r'<title>.*?</title>', html).group(0)
js = js.replace('</script', '<\\/script')
out = f"""{title}
{fonts}
<style>{css}</style>
<div id="app"></div>
<script type="module">{js}</script>
"""
pathlib.Path(sys.argv[2]).write_text(out, encoding='utf-8')
print(len(out))
