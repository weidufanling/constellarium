"""Build Constellarium as one static HTML file with exact inline CSP pins."""
import base64
import hashlib
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent

def read(name):
    return (root / name).read_text(encoding='utf-8')

def pin(value):
    return base64.b64encode(hashlib.sha256(value.encode('utf-8')).digest()).decode('ascii')

style = '\n' + ''.join(read(name) for name in ('style.css', 'catalog.css', 'journey.css'))
script = '\n(() => {\n\'use strict\';\n'
script += 'const land = ' + read('land.json').strip() + ';\n'
script += ''.join(read(name) for name in ('specialists.js', 'globe.js', 'app.js',
                                          'capabilities.js', 'catalog.js', 'journey.js'))
script += '})();\n'
page = read('page-template.html')
replacements = {
    'STYLE': style, 'SCRIPT': script, 'STYLE_HASH': pin(style), 'SCRIPT_HASH': pin(script),
    'CATALOGUE': read('catalog-fragment.html').strip(), 'JOURNEY': read('journey-fragment.html').strip()
}
for key, value in replacements.items():
    page = page.replace('__' + key + '__', value)
assert not re.search(r'__[A-Z_]+__', page)
for tag, expected in [('script', script), ('style', style)]:
    actual, = re.findall(f'<{tag}>(.*?)</{tag}>', page, re.S)
    assert actual == expected and 'sha256-' + pin(actual) in page
assert not any(mark in page for mark in '\u2013\u2014')
target = Path(sys.argv[1]) if len(sys.argv) > 1 else root/'index.html'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(page.encode('utf-8'))
