"""src/ と data/localtexts.json から 1 ファイルの index.html を生成する。
使い方: python3 tools/build.py
"""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
t = (root / 'src/template.html').read_text(encoding='utf-8')
lt = (root / 'data/localtexts.json').read_text(encoding='utf-8').replace('</', '<\\/')
for key, name in [('__LOGIC__', 'logic.js'), ('__NATIONAL__', 'national.js'), ('__APP__', 'app.js')]:
    t = t.replace(key, (root / 'src' / name).read_text(encoding='utf-8'))
t = t.replace('__LOCALTEXTS__', lt)
(root / 'index.html').write_text(t, encoding='utf-8')
print('index.html', len(t.encode()), 'bytes')
