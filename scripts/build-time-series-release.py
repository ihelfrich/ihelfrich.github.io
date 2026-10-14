"""Assemble the public book source and archives, excluding private instructor material."""
from pathlib import Path
import json,re,shutil,zipfile,subprocess,sys
SITE=Path(__file__).resolve().parents[1];PUBLIC=SITE/'public/time-series';SOURCE=PUBLIC/'source';DOWNLOADS=PUBLIC/'downloads'
BASE='https://ihelfrich.github.io'
SOURCE.mkdir(exist_ok=True);DOWNLOADS.mkdir(exist_ok=True)
fonts=SOURCE/'fonts';fonts.mkdir(exist_ok=True)
font_files=['lmmonolt10-regular.otf','lmmonolt10-bold.otf','lmmonolt10-oblique.otf','lmmonolt10-boldoblique.otf','latinmodern-math.otf']
if any(not (fonts/name).exists() for name in font_files):
    texdist=Path(subprocess.check_output(['kpsewhich','--var-value=TEXMFDIST'],text=True).strip())
    for name in font_files:
        family='lm-math' if name=='latinmodern-math.otf' else 'lm'
        shutil.copy2(texdist/f'fonts/opentype/public/{family}/{name}',fonts/name)
    for family,names in [('lm',['GUST-FONT-LICENSE.TXT','README-Latin-Modern.TXT','MANIFEST-Latin-Modern.TXT']),('lm-math',['GUST-FONT-LICENSE.txt','README-Latin-Modern-Math.txt','MANIFEST-Latin-Modern-Math.txt'])]:
        for name in names:
            shutil.copy2(texdist/f'doc/fonts/{family}/{name}',fonts/(family+'-'+name))
def transform(s):
    s=re.sub(r'^---\n.*?\n---\n','',s,count=1,flags=re.S)
    s=re.sub(r'<details>\s*<summary>(.*?)</summary>',r'\n**\1**\n',s,flags=re.S);s=s.replace('</details>','')
    s=re.sub(r'<span id="[^"]*">(.*?)</span>',r'\1',s)
    s=re.sub(r'!\[([^\]]*)\]\(/time-series/figures/([^)]*)\.svg\)',r'![\1](../figures/\2.pdf)',s)
    s=re.sub(r'(?<!\!)\]\((/[^)]*)\)',lambda m:']('+BASE+m[1]+')',s)
    # Actual headings, links, equations, and worked solutions remain authored source.
    return s.strip()+'\n'
files=[]
for p in sorted((SITE/'src/content/time-series').glob('*.md')):
    s=p.read_text();title=re.search(r'^title: (.*)$',s,re.M)[1];n=int(re.search(r'^order: (\d+)$',s,re.M)[1]);out=p.stem+'.qmd'
    (SOURCE/out).write_text(f'# Lecture {n}: {title}\n\n'+transform(s));files.append(out)
for name,title in [('projects','Three projects and the worked empirical case'),('practice','Assignments, worked practice, and public examination'),('code','Executable laboratories and reproducibility'),('methods','References, design, and provenance')]:
    out=name+'.qmd';(SOURCE/out).write_text('# '+title+'\n\n'+transform((SITE/f'src/pages/time-series/{name}.md').read_text()));files.append(out)
(SOURCE/'index.qmd').write_text('''# The forecast and its evidence {.unnumbered}

This book teaches time-series econometrics through a continuing economic decision. Derivations, executable examples, deliberate failures, and repairs form one argument. A forecast is recorded before its outcome is revealed. A revision must preserve its selection record and survive a later comparison.

The fifteen lectures cover stationary dynamics, ARMA, chronological forecasting, measurement and filtering, stochastic trends, dynamic regression, latent states, VARs and networks, structural identification, cointegration, conditional volatility, changing environments, and model revision. Applications connect financial risk with economic measurement, geographic exposure, and regional dependence. Three projects carry one procedure through Build, Audit, and Revise.

Read a chapter before its lecture, reproduce the laboratory in your preferred language, and attempt its practice problems before reading the answers. R, Julia, and Python independently implement the same declared quantities. Students need one language; parallel implementations provide evidence about conventions and reproducibility. All code, fixed inputs, and verification results are available with the online book.

The observed Texas example uses a fixed EIA/NOAA vintage with a clearly labeled two-month teaching release lag. Its final seasonal benchmark narrowly beats the selected revision. That result belongs in the argument; sophistication alone is not evidence of a better deployment decision.

Public practice includes worked solutions. Live assessments, grading keys, and graded continuation data are kept in the instructor package. Course dates, assessment arrangements, and section details belong to the syllabus.

First edition, October 2026. Copyright © 2026 Ian Helfrich. All rights reserved. Provider data, cited works, and bundled fonts retain their own terms. Public access to authored source does not grant a blanket redistribution or adaptation license.

[Online book](https://ihelfrich.github.io/time-series/) · [Lecture materials](https://ihelfrich.github.io/time-series/lectures/) · [Code and data](https://ihelfrich.github.io/time-series/code/)
''')
config='''project:
  type: book
  output-dir: _book
book:
  title: Time-Series Econometrics
  subtitle: Decisions, measurement, dynamics, and evidence
  author: Ian Helfrich, PhD
  date: October 2026
  date-format: MMMM YYYY
  chapters:
    - index.qmd
'''+''.join('    - '+f+'\n' for f in files)+'''format:
  pdf:
    documentclass: scrreprt
    papersize: letter
    fontsize: 12pt
    syntax-highlighting: none
    geometry: [margin=1in]
    mainfont: SourceSans3-Regular.otf
    mainfontoptions:
      - Path=fonts/
      - BoldFont=SourceSans3-Bold.otf
      - ItalicFont=SourceSans3-RegularIt.otf
      - BoldItalicFont=SourceSans3-BoldIt.otf
    sansfont: SourceSans3-Regular.otf
    sansfontoptions:
      - Path=fonts/
      - BoldFont=SourceSans3-Bold.otf
      - ItalicFont=SourceSans3-RegularIt.otf
      - BoldItalicFont=SourceSans3-BoldIt.otf
    monofont: lmmonolt10-regular.otf
    monofontoptions:
      - Path=fonts/
      - BoldFont=lmmonolt10-bold.otf
      - ItalicFont=lmmonolt10-oblique.otf
      - BoldItalicFont=lmmonolt10-boldoblique.otf
    mathfont: latinmodern-math.otf
    mathfontoptions:
      - Path=fonts/
    colorlinks: true
    linkcolor: black
    urlcolor: black
    citecolor: black
    toc: true
    toc-depth: 2
    number-sections: false
    keep-tex: true
    pdf-engine: xelatex
    latex-auto-install: false
    output-file: time-series-econometrics.pdf
    include-in-header:
      text: |
        \\usepackage{microtype}
        \\pagestyle{plain}
        \\setlength{\\emergencystretch}{3em}
        \\raggedbottom
execute:
  enabled: false
'''
(SOURCE/'_quarto.yml').write_text(config)
(SOURCE/'README.md').write_text('# Editable print source\n\nFrom this directory run `quarto render --to pdf`. Quarto and XeLaTeX are required. Scientific figures are supplied in the neighboring figures directory. The public source ZIP preserves that directory structure. The reference build uses Quarto 1.10.18 and TeX Live 2026, 12-point embedded Source Sans 3 on US Letter. Live assessments and instructor scripts are excluded.\n')
if '--render' in sys.argv:
    subprocess.run(['quarto','render','--to','pdf'],cwd=SOURCE,check=True)
if '--render' in sys.argv or '--finalize' in sys.argv:
    candidates=list((SOURCE/'_book').glob('*.pdf'));assert len(candidates)==1,candidates
    shutil.copy2(candidates[0],DOWNLOADS/'time-series-econometrics.pdf')
# PDF compilation products never belong in public assets.
if (SOURCE/'_book').exists():shutil.rmtree(SOURCE/'_book')
if (SOURCE/'.quarto').exists():shutil.rmtree(SOURCE/'.quarto')
for p in SOURCE.iterdir():
    if p.is_file() and p.suffix in ['.tex','.log','.aux','.out','.toc','.fls','.fdb_latexmk']:
        p.unlink()
for p in (PUBLIC/'code').rglob('__pycache__'):
    shutil.rmtree(p)
def include(p):
    return p.is_file() and not any(x in p.parts for x in ['.venv','__pycache__','.julia-depot','_book','.quarto']) and p.suffix not in ['.pyc','.log','.aux','.out','.toc']
with zipfile.ZipFile(DOWNLOADS/'time-series-labs.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted((PUBLIC/'code').rglob('*')):
        if include(p):z.write(p,'code/'+str(p.relative_to(PUBLIC/'code')))
with zipfile.ZipFile(DOWNLOADS/'time-series-public-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for folder in ['code','source','figures']:
        for p in sorted((PUBLIC/folder).rglob('*')):
            if include(p):z.write(p,folder+'/'+str(p.relative_to(PUBLIC/folder)))
    for p in sorted((SITE/'src/content/time-series').glob('*.md')):z.write(p,'chapters/'+p.name)
    for name in ['projects','practice','code','methods']:
        p=SITE/f'src/pages/time-series/{name}.md';z.write(p,'pages/'+p.name)
    for folder in ['src/pages/time-series/lectures','src/layouts','src/components/time-series']:
        for p in (SITE/folder).glob('*'):
            if include(p) and ('TimeSeries' in p.name or 'time-series' in folder):z.write(p,str(p.relative_to(SITE)))
    for name in ['src/data/time-series-lectures.json','src/styles/time-series.css','src/scripts/time-series-experiments.ts','scripts/build-time-series-release.py']:
        z.write(SITE/name,name)
    for name in ['src/pages/time-series/[slug].astro','src/pages/time-series/research.astro','public/time-series/research-register.json']:
        z.write(SITE/name,name)
print([(p.name,p.stat().st_size) for p in DOWNLOADS.iterdir()])
