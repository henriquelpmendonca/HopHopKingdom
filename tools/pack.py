"""Gera os pacotes dos portais a partir de dist/ e dist-poki/ (rode com: npm run pack).
- dist-flat/: CrazyGames, que não aceita zip nem pastas no envio; tudo na raiz, com os caminhos ajustados;
- marketing/poki/HopHopKingdom_poki.zip: Poki, com index.html na raiz do zip.
"""
import glob, os, shutil, zipfile

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

# CrazyGames
shutil.rmtree('dist-flat', ignore_errors=True)
os.makedirs('dist-flat')
for f in glob.glob('dist/assets/*'):
    shutil.copy(f, 'dist-flat')
shutil.copy('dist/index.html', 'dist-flat')
for f in glob.glob('dist-flat/index*'):
    with open(f, encoding='utf-8', newline='') as h:
        s = h.read()
    s = s.replace('assets/', '')
    # no CSS as imagens apontam para a pasta de cima; sem isto os ícones somem no portal, que serve o jogo numa subpasta
    if f.endswith('.css'):
        s = s.replace('../', '')
    with open(f, 'w', encoding='utf-8', newline='') as h:
        h.write(s)
print('dist-flat:', len(os.listdir('dist-flat')), 'arquivos')

# Poki
os.makedirs('marketing/poki', exist_ok=True)
out = 'marketing/poki/HopHopKingdom_poki.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for r, _, fs in os.walk('dist-poki'):
        for f in fs:
            p = os.path.join(r, f)
            z.write(p, os.path.relpath(p, 'dist-poki').replace(os.sep, '/'))
print(out, round(os.path.getsize(out) / 1e6, 1), 'MB')
