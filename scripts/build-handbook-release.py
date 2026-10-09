"""Prepare the opening handbook edition and an explicitly scoped source archive."""
from pathlib import Path
import hashlib, json, re, shutil, sys, zipfile

SITE=Path(__file__).resolve().parents[1]
PUBLIC=SITE/'public/handbook'
SOURCE=PUBLIC/'source'; DOWNLOADS=PUBLIC/'downloads'
SOURCE.mkdir(parents=True,exist_ok=True); DOWNLOADS.mkdir(exist_ok=True)

def prepare():
    fixture=PUBLIC/'code/data/alert-days.csv'
    manifest={'kind':'authored controlled finite teaching fixture',
        'empirical_observations':False,'file':'alert-days.csv',
        'sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),
        'rows':6,'probability':'weight divided by the sum of all six weights',
        'schema':{'state':'integer row identifier','u':'heat indicator, 0 or 1',
                  'v_mw':'demand shock in MW, -1, 0, or 1','weight':'positive integer probability weight'},
        'structural_model':'A=U; Y=10+b*A+(2-b)*U+V; -2<=b<=2',
        'intervention':'replace A=U with A=a; preserve the six background states and load equation',
        'randomized_design':'independent binary A crossed with six background states; twelve probabilities 1/12',
        'reference_time':'not applicable: enumerated types, not dated empirical records',
        'release_time':'not applicable: controlled teaching fixture',
        'authorship':'Ian Helfrich, October 2026',
        'rights':'Author-owned controlled example; all rights reserved. No external data included.'}
    (PUBLIC/'code/data/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    fonts=SOURCE/'fonts';fonts.mkdir(exist_ok=True)
    for p in (SITE/'public/time-series/source/fonts').iterdir():
        if p.is_file():shutil.copy2(p,fonts/p.name)
    import matplotlib
    mpl_fonts=Path(matplotlib.get_data_path())/'fonts/ttf'
    for name in ['DejaVuSans.ttf','LICENSE_DEJAVU']:
        shutil.copy2(mpl_fonts/name,fonts/name)
    text=(SITE/'src/content/handbook/01-questions.md').read_text()
    text=re.sub(r'^---\n.*?\n---\n','',text,count=1,flags=re.S)
    text=re.sub(r'<span id="([^"]+)"></span>\s*\n(## [^\n]+)',r'\2 {#\1}',text)
    text=re.sub(r'<picture>.*?</picture>',
        '![Observed alert groups share one distribution while assigned-alert responses differ.](../figures/alert-worlds-print.pdf){width=80%}',text,flags=re.S)
    # Relative web links become working online destinations; internal proof anchors stay local.
    text=re.sub(r'\]\((/[^)]+)\)',r'](https://ihelfrich.github.io\1)',text)
    def glyphs(s):
        for g in '○◇◆✦':
            s=s.replace(g,'\\texorpdfstring{\\levelglyph{'+g+'}}{}')
        return s
    (SOURCE/'01-questions.qmd').write_text('# Economic questions, useful predictions, and interventions {#ch-one}\n\n'+glyphs(text))
    (SOURCE/'index.qmd').write_text(glyphs('''# Reading this working edition {.unnumbered}

Econometrics begins with a question about a measured world. This handbook develops the mathematical tools needed to state that question, investigate it, and explain the conditions under which an answer follows. Concrete examples and pictures accompany fully explained proofs and independent Python, Julia, and R calculations.

This working edition contains the opening foundation chapter. The broader seventy-two-chapter manuscript is being developed. The separate fifteen-lecture time-series course is available at [ihelfrich.github.io/time-series](https://ihelfrich.github.io/time-series/); it supplies material for the dynamic-systems part of the broader book. Its existing chapter numbering is retained in the linked course.

## Four reading levels

○ **Orientation** begins with a concrete question and defines unfamiliar terms. Arithmetic and pictures support a route for a reader whose mathematical training is still developing.

◇ **Core** develops the calculation, its assumptions, and its economic meaning. Later chapters build the algebra, probability, calculus, and linear algebra they require.

◆ **Theory** gives precise definitions and complete proofs. Chapter 1's finite identification argument can be followed before advanced probability. Later technical passages add the spaces, convergence, and identification conditions needed for doctoral work.

✦ **Workshop** gives a bounded exercise or research investigation. Its status is explicit. Chapter 1's workshop consists of worked practice in a controlled example, not new empirical findings or open research problems.

The glyphs accompany text labels. They indicate a passage's requirements and purpose, not a reader's ability. The introductory route retains the assumptions and meaning of a result even when its more technical proof is deferred.

## Claims and calculations

The first chapter supplies a question contract, exact finite calculations, a proof of the squared-error forecast rule, and proofs of nonidentification and the limits of estimation. Direct section links name the definition or result being used. Its utility alert example is entirely controlled. The empirical Texas electricity dataset is separate and does not estimate the alert effect.

Python, Julia, and R independently reproduce the declared numerical quantities. Their agreement is a calculation check. Mathematical claims rely on the written proofs, and economic validity relies on the stated model and design. Source, input manifest, native verification results, and original figures accompany this edition.

Public practice includes complete worked answers. Live assessments, grading keys, instructor scripts, generator truth, and held-out graded continuation remain private.

Working edition, October 2026. © Ian Helfrich. All rights reserved. Authored text, code, and figures remain author-owned. Cited works are linked and not redistributed. Bundled font files retain their included licenses.

[Online handbook](https://ihelfrich.github.io/handbook/) · [Chapter 1](https://ihelfrich.github.io/handbook/01-questions/) · [Three-language code](https://ihelfrich.github.io/handbook/code/README.md)
'''))
    config=(SITE/'public/time-series/source/_quarto.yml').read_text()
    start=config.index('  chapters:');end=config.index('\nformat:')+1
    config=config[:start]+'  chapters:\n    - index.qmd\n    - 01-questions.qmd\n'+config[end:]
    config=config.replace('title: Time-Series Econometrics','title: Econometrics Across Disciplines')
    config=config.replace('subtitle: Decisions, measurement, dynamics, and evidence','subtitle: Measurement, models, and decisions')
    config=config.replace('output-file: time-series-econometrics.pdf','output-file: econometrics-handbook-working.pdf')
    config=config.replace('\\usepackage{microtype}','\\usepackage{microtype}\n        \\newfontfamily\\levelsymbols[Path=fonts/]{DejaVuSans.ttf}\n        \\newcommand{\\levelglyph}[1]{{\\levelsymbols#1}}')
    (SOURCE/'_quarto.yml').write_text(config)
    (SOURCE/'README.md').write_text('''# Editable handbook source

Run `quarto render --to pdf` from this directory. Quarto and XeLaTeX are required; automatic TeX installation is disabled. The reference build uses Quarto 1.10.18, TeX Live 2026, US Letter, 12-point embedded Source Sans 3, one-inch margins, and page numbers. DejaVu Sans supplies the four reading-level glyphs; its license is included. Latin Modern supplies mathematical and code fonts under its included GUST licenses.

Chapter-local links become PDF destinations. Root-relative web links become full online URLs. `../figures/alert-worlds-print.pdf` is the original vector print figure with enlarged labels and vertically arranged panels. The neighboring `code` directory contains the controlled fixture, manifest and independent implementations. Web Markdown is in `chapters/01-questions.md`; the Astro files are source for integration with Ian Helfrich's existing site, not a standalone replacement site.

This working edition contains one foundation chapter. It is not the complete seventy-two-chapter handbook. Live assessments and grading keys are excluded.
''')

if '--finalize' not in sys.argv:
    prepare()
else:
    candidates=list((SOURCE/'_book').glob('*.pdf'))
    assert len(candidates)==1,candidates
    pdf=candidates[0]
    shutil.copy2(pdf,DOWNLOADS/'econometrics-handbook-working.pdf')
    for name in ['_book','.quarto']:
        p=SOURCE/name
        if p.exists():shutil.rmtree(p)
    for p in SOURCE.iterdir():
        if p.is_file() and p.suffix in {'.tex','.log','.aux','.out','.toc','.fls','.fdb_latexmk'}:p.unlink()
    for p in (PUBLIC/'code').rglob('__pycache__'):shutil.rmtree(p)
    with zipfile.ZipFile(DOWNLOADS/'econometrics-handbook-source.zip','w',zipfile.ZIP_DEFLATED) as z:
        for folder in ['code','source','figures']:
            for p in sorted((PUBLIC/folder).rglob('*')):
                if p.is_file() and p.suffix!='.pyc':z.write(p,str(p.relative_to(PUBLIC)))
        p=SITE/'src/content/handbook/01-questions.md';z.write(p,'chapters/'+p.name)
        z.write(PUBLIC/'source-register.json','source-register.json')
        for name in ['src/layouts/Handbook.astro','src/styles/handbook.css','src/pages/handbook/index.astro',
                     'src/pages/handbook/[slug].astro','src/pages/handbook/print.astro','scripts/build-handbook-release.py',
                     'src/components/handbook/AlertWorlds.astro','src/lib/handbook-worlds.mjs','src/scripts/handbook-worlds.ts']:
            z.write(SITE/name,name)
    print(json.dumps({p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
                      for p in DOWNLOADS.iterdir()},indent=2))
