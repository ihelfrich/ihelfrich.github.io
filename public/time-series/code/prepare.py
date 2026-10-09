"""Create chapter entry points and provenance; run only when editing the course."""
from pathlib import Path
import hashlib
import json
from course import fixtures

root=Path(__file__).resolve().parent
fixtures()
for n in range(1,16):
    label=f'ch{n:02d}'
    (root/f'{label}.py').write_text(f'"""Lecture {n}: executable entry point. See course.py for the complete implementation."""\nfrom course import run\nif __name__ == "__main__":\n    run({n}, "results/{label}-python.csv")\n')
    (root/f'{label}.R').write_text(f'# Lecture {n}: see course.R for the complete implementation.\nsource("course.R")\nrun({n}, "results/{label}-r.csv")\n')
    (root/f'{label}.jl').write_text(f'# Lecture {n}: see course.jl for the complete implementation.\ninclude("course.jl")\nrun({n}, "results/{label}-julia.csv")\n')
manifest={"generator":"Park-Miller LCG a=48271, m=2147483647; Box-Muller; seed=515; row-major 2048x6", "kind":"synthetic standard-normal innovations, not observed economic data", "sha256":hashlib.sha256((root/'data/innovations.csv').read_bytes()).hexdigest(), "rows":2048,"columns":6,"convention":"ARMA uses plus theta; variance population denominator n unless explicitly stated; QR least squares; forecast origin last observed row"}
(root/'data/innovations-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
