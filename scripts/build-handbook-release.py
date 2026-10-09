"""Prepare available handbook chapters and an explicitly scoped editable archive."""
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
    meter=PUBLIC/'code/data/meter-states.csv'
    measurement_manifest={'kind':'authored controlled finite teaching fixture','empirical_observations':False,
        'file':meter.name,'sha256':hashlib.sha256(meter.read_bytes()).hexdigest(),'rows':36,
        'probability':'each positive integer weight divided by total weight; all 36 weights equal one',
        'schema':{'state':'row identifier','x_mwh':'true facility-day energy in MWh, 8 or 12',
                  'z1':'first meter noise multiplier, -1, 0, or 1','z2':'independent second multiplier',
                  'epsilon_dollars':'independent billing perturbation, -20 or 20 dollars','weight':'integer probability weight'},
        'model':'Y=30+50X+epsilon; Mj=X+kappa*(X-10)+h*Zj',
        'units':{'Y':'dollars','X':'MWh','Mj':'MWh','h':'MWh','kappa':'dimensionless','billing_slope':'dollars/MWh'},
        'parameters':{'h_mwh':[0,2,4],'kappa':[0,-0.5,-2]},
        'assumptions':'X,Z1,Z2,epsilon independent; two readings share the declared calibration',
        'denominator_example':'energy remains 3000 MWh; true population remains 300; counted denominator changes from 300 to 240',
        'aggregate_example':'two disjoint zones: Q=(1000,3000) MWh; N=(100,200) customers',
        'timing':'enumerated facility-day possibilities and controlled coverage examples; no dated empirical records',
        'rights':'Author-owned teaching fixture; all rights reserved. No external data included.'}
    (PUBLIC/'code/data/measurement-manifest.json').write_text(json.dumps(measurement_manifest,indent=2)+'\n')
    fonts=SOURCE/'fonts';fonts.mkdir(exist_ok=True)
    for p in (SITE/'public/time-series/source/fonts').iterdir():
        if p.is_file():shutil.copy2(p,fonts/p.name)
    import matplotlib
    mpl_fonts=Path(matplotlib.get_data_path())/'fonts/ttf'
    for name in ['DejaVuSans.ttf','LICENSE_DEJAVU']:
        shutil.copy2(mpl_fonts/name,fonts/name)
    def glyphs(s):
        for g in '○◇◆✦':
            s=s.replace(g,'\\texorpdfstring{\\levelglyph{'+g+'}}{}')
        return s
    chapters=sorted((SITE/'src/content/handbook').glob('*.md'))
    for chapter in chapters:
        raw=chapter.read_text();title=re.search(r'^title:\s*(.+)$',raw,re.M).group(1).strip("'\"")
        text=re.sub(r'^---\n.*?\n---\n','',raw,count=1,flags=re.S)
        text=re.sub(r'<span id="([^"]+)"></span>\s*\n(## [^\n]+)',r'\2 {#\1}',text)
        def picture(match):
            block=match.group(0);stem=re.search(r'<img src="/handbook/figures/([^"/]+)\.svg"',block).group(1)
            caption=match.group(1).strip()
            return f'![{caption}](../figures/{stem}-print.pdf){{width=72%}}\n\n'
        text=re.sub(r'<picture>.*?</picture>\s*\n\*\*Figure \d+\.\*\*([^\n]+)\n\n',picture,text,flags=re.S)
        # Available-chapter references become checked PDF destinations; course links stay online.
        for target in chapters:
            text=text.replace(f'](/handbook/{target.stem}/#',f']({target.stem}.qmd#')
            text=text.replace(f'](/handbook/{target.stem}/)',f']({target.stem}.qmd)')
        text=re.sub(r'\]\((/[^)]+)\)',r'](https://ihelfrich.github.io\1)',text)
        if chapter.stem=='01-questions':
            text+='\n\n\\clearpage\n\n## Assignment comparison {#alert-experiment}\n\nThe online experiment asks for a prediction before revealing assigned-alert means. These static comparisons use the same six background states under each assignment. The observed group means remain 10 and 12 MW throughout.\n\n| Effect b, MW | Assigned no alert, MW | Assigned alert, MW | Paired effect, MW |\n| --- | --- | --- | --- |\n'
            for b in [-2,-1,0,1,2]:text+=f'| {b} | {11-b/2:g} | {11+b/2:g} | {b} |\n'
            text+='\nConditioning selects the background types under the existing rule; assignment retains the common background distribution. The intervention proof explains why those operations answer different questions.\n'
        if chapter.stem=='02-measurement':
            reference=json.loads((PUBLIC/'code/results/measurement-reference.json').read_text())
            text+='\n\n\\clearpage\n\n## Instrument comparison {#measurement-experiment}\n\nThe online experiment asks for a prediction before revealing a population line. These static comparisons retain all nine parameter settings for this edition. The billing coefficient is 50 dollars per true MWh throughout. A calibration error changes the interpretation of both recorded readings.\n\n| Noise h, MWh | Calibration | Recorded slope, dollars/MWh | Twin covariance ratio, dollars/MWh |\n| --- | --- | --- | --- |\n'
            for h in [0,2,4]:
                for name in ['classical','compressed','reversed']:
                    key=f'h{h}_{name}_'
                    text+=f'| {h} | {name} | {reference[key+"slope"]:.5g} | {reference[key+"twin_ratio"]:.5g} |\n'
            text+='\nThe twin ratio recovers the declared coefficient only under the repeated-reading assumptions proved in this chapter. The archive includes each native implementation and its checked outputs.\n'
        if chapter.stem=='03-clocks':
            import csv
            origins=list(csv.DictReader((PUBLIC/'code/data/clock-origins.csv').open()))
            reference=json.loads((PUBLIC/'code/results/clocks-reference.json').read_text())
            text+='\n\n\\clearpage\n\n## Release comparison {#clocks-experiment}\n\nThe online experiment asks for a prediction before showing an origin-specific selection. These static comparisons use zero collection delay and add 10 percentage points only to events unavailable at each origin. The mutations are authored audit tests, not BEA estimates.\n\n| Origin date, UTC | Time, UTC | Eligible stage | Eligible growth, percent | Entire test archive, percent |\n| --- | --- | --- | --- | --- |\n'
            for o in origins:
                key=f'gdp_o{o["origin_id"]}_d0_';stage=int(reference[key+'stage'])
                name=['Not released','Advance','Second','Third'][stage]
                growth=f'{reference[key+"growth"]:g}' if stage else 'Missing'
                date,time=o['origin_utc'].removesuffix('Z').split('T')
                text+=f'| {date} | {time} | {name} | {growth} | {reference[key+"mutated_latest_value"]:g} |\n'
            text+='\nAt the first-publication boundary, a 60-second delay retains missingness until 12:31 UTC; a 3,600-second delay retains it until 13:30 UTC. At subsequent boundaries, the prior estimate remains selected during the delay. The native programs check all 27 origin/delay combinations and keep absence distinct from zero.\n'
        (SOURCE/(chapter.stem+'.qmd')).write_text('# '+title+' {#ch-'+chapter.stem+'}\n\n'+glyphs(text))
    (SOURCE/'index.qmd').write_text(glyphs('''# Reading this working edition {.unnumbered}

Econometrics begins with a question about a measured world. This handbook develops the mathematical tools needed to state that question, investigate it, and explain the conditions under which an answer follows. Concrete examples and pictures accompany fully explained proofs and independent Python, Julia, and R calculations.

This working edition contains three foundation chapters: economic questions, measurement, and observation clocks. The broader seventy-two-chapter manuscript is being developed. The separate fifteen-lecture time-series course is available at [ihelfrich.github.io/time-series](https://ihelfrich.github.io/time-series/); it supplies material for the dynamic-systems part of the broader book. Its existing chapter numbering is retained in the linked course.

## Four reading levels

○ **Orientation** begins with a concrete question and defines unfamiliar terms. Arithmetic and pictures support a route for a reader whose mathematical training is still developing.

◇ **Core** develops the calculation, its assumptions, and its economic meaning. Later chapters build the algebra, probability, calculus, and linear algebra they require.

◆ **Theory** gives precise definitions and complete proofs. Chapter 1's finite identification argument can be followed before advanced probability. Later technical passages add the spaces, convergence, and identification conditions needed for doctoral work.

✦ **Workshop** gives a bounded exercise or research investigation. Its status is explicit. Chapter 1's workshop consists of worked practice in a controlled example, not new empirical findings or open research problems.

The glyphs accompany text labels. They indicate a passage's requirements and purpose, not a reader's ability. The introductory route retains the assumptions and meaning of a result even when its more technical proof is deferred.

## Claims and calculations

The first chapter supplies a question contract, exact finite calculations, a proof of the squared-error forecast rule, and proofs of nonidentification and the limits of estimation. The second supplies a measurement dictionary, proofs of the population projection and classical attenuation, a repeated-reading correction with explicit restrictions, calibration failures, and denominator/aggregation audits. The third builds an as-of release ledger, proves prefix invariance, develops finite filtrations and adapted forecasts, proves the information-gain identity, and separates input and target vintages. Direct section links name the definition or result being used. The first two chapters use entirely controlled examples. The third adds a small attributed BEA release-history extract alongside separate controlled models; it does not fit a GDP nowcast. The empirical Texas electricity dataset is separate and does not estimate the alert effect or validate the controlled meter.

Python, Julia, and R independently reproduce the declared numerical quantities. Their agreement is a calculation check. Mathematical claims rely on the written proofs, and economic validity relies on the stated model and design. Source, input manifest, native verification results, and original figures accompany this edition.

Public practice includes complete worked answers. Live assessments, grading keys, instructor scripts, generator truth, and held-out graded continuation remain private.

Working edition, October 2026. © Ian Helfrich. All rights reserved. Authored text, code, and figures remain author-owned. Cited works are linked and not redistributed. Bundled font files retain their included licenses.

[Online handbook](https://ihelfrich.github.io/handbook/) · [Chapter 1](https://ihelfrich.github.io/handbook/01-questions/) · [Three-language code](https://ihelfrich.github.io/handbook/code/README.md)
'''))
    config=(SITE/'public/time-series/source/_quarto.yml').read_text()
    start=config.index('  chapters:');end=config.index('\nformat:')+1
    config=config[:start]+'  chapters:\n    - index.qmd\n'+''.join('    - '+p.stem+'.qmd\n' for p in chapters)+config[end:]
    config=config.replace('title: Time-Series Econometrics','title: Econometrics Across Disciplines')
    config=config.replace('subtitle: Decisions, measurement, dynamics, and evidence','subtitle: Measurement, models, and decisions')
    config=config.replace('output-file: time-series-econometrics.pdf','output-file: econometrics-handbook-working.pdf')
    config=config.replace('\\usepackage{microtype}','\\usepackage{microtype}\n        \\newfontfamily\\levelsymbols[Path=fonts/]{DejaVuSans.ttf}\n        \\newcommand{\\levelglyph}[1]{{\\levelsymbols#1}}')
    (SOURCE/'_quarto.yml').write_text(config)
    (SOURCE/'README.md').write_text('''# Editable handbook source

Run `quarto render --to pdf` from this directory. Quarto and XeLaTeX are required; automatic TeX installation is disabled. The reference build uses Quarto 1.10.18, TeX Live 2026, US Letter, 12-point embedded Source Sans 3, one-inch margins, and page numbers. DejaVu Sans supplies the four reading-level glyphs; its license is included. Latin Modern supplies mathematical and code fonts under its included GUST licenses.

Chapter-local links and links to available handbook chapters become PDF destinations. Other root-relative web links become full online URLs. The `../figures/*-print.pdf` files are original vector print figures with enlarged labels and vertically arranged panels. The neighboring `code` directory contains controlled fixtures, the small attributed BEA extract, manifests and independent implementations. Web Markdown is in `chapters/`; the Astro files are source for integration with Ian Helfrich's existing site, not a standalone replacement site.

This working edition contains three foundation chapters. It is not the complete seventy-two-chapter handbook. Live assessments and grading keys are excluded.
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
        for p in sorted((SITE/'src/content/handbook').glob('*.md')):z.write(p,'chapters/'+p.name)
        z.write(PUBLIC/'source-register.json','source-register.json')
        for name in ['src/layouts/Handbook.astro','src/styles/handbook.css','src/pages/handbook/index.astro',
                     'src/pages/handbook/[slug].astro','src/pages/handbook/print.astro','scripts/build-handbook-release.py',
                     'src/components/handbook/AlertWorlds.astro','src/lib/handbook-worlds.mjs','src/scripts/handbook-worlds.ts',
                     'src/components/handbook/MeasurementWorlds.astro','src/lib/handbook-measurement.mjs','src/scripts/handbook-measurement.ts',
                     'src/components/handbook/ClockAudit.astro','src/lib/handbook-clocks.mjs','src/scripts/handbook-clocks.ts']:
            z.write(SITE/name,name)
    print(json.dumps({p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
                      for p in DOWNLOADS.iterdir()},indent=2))
