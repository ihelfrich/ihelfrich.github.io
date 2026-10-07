"""Validate and merge staged additional HYCOM layers into the existing atlas."""
from pathlib import Path
import importlib.util,json,shutil
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'public/hidden-rivers/data';STAGED=Path('/tmp/hidden-rivers-deep-layers')
spec=importlib.util.spec_from_file_location('validation',Path(__file__).with_name('validate-release.py'))
validation=importlib.util.module_from_spec(spec);spec.loader.exec_module(validation)
validation.validate(STAGED)
original=json.loads((DATA/'manifest.json').read_text());extra=json.loads((STAGED/'manifest.json').read_text())
diagnostics=json.loads((DATA/'diagnostics.json').read_text());additional=json.loads((STAGED/'diagnostics.json').read_text())
for region in extra['regions']:
    target=next(r for r in original['regions'] if r['id']==region['id'])
    depths={l['depth'] for l in region['layers']}
    target['layers']=sorted([l for l in target['layers'] if l['depth'] not in depths]+region['layers'],key=lambda l:l['depth'])
    for layer in region['layers']:shutil.copy2(STAGED/layer['file'],DATA/layer['file'])
for region in additional['regions']:
    target=next(r for r in diagnostics['regions'] if r['id']==region['id'])
    depths={l['depth'] for l in region['layers']}
    target['layers']=sorted([l for l in target['layers'] if l['depth'] not in depths]+region['layers'],key=lambda l:l['depth'])
    for layer in region['layers']:
        for field in layer['fields'].values():shutil.copy2(STAGED/field['file'],DATA/field['file'])
# Recompute the declared shared display domains over the expanded release.
for name in ['vorticity','strain','divergence','okuboWeiss','ftle']:
    fields=[l['fields'][name] for r in diagnostics['regions'] for l in r['layers']]
    values=np.concatenate([np.fromfile(DATA/f['file'],dtype='<f4') for f in fields]);values=values[np.isfinite(values)]
    signed=name in ['vorticity','divergence','okuboWeiss'];limit=float(np.percentile(np.abs(values) if signed else values,98))
    lower=-limit if signed else min(0.,float(np.percentile(values,2))) if name=='ftle' else 0
    for field in fields:field['displayDomain']=[lower,limit]
shutil.copy2(STAGED/'source-requests-deep.json',DATA/'source-requests-deep.json')
(DATA/'manifest.json').write_text(json.dumps(original,indent=2)+'\n')
(DATA/'diagnostics.json').write_text(json.dumps(diagnostics,indent=2,allow_nan=False)+'\n')
report=validation.validate(DATA)
print('Merged and validated depths:',[l['depth'] for l in original['regions'][0]['layers']])
