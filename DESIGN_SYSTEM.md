# Design system: portrait, paper, signal

The site is built around Ian Helfrich's actual overlap: research economist, teacher, and instrument builder. Its visual system pairs editorial authority with computational legibility.

## Color

- **Portrait midnight `#121426`** comes from the blue-black shadows in Ian's editorial portrait. It replaces generic web black and carries the research-console surfaces.
- **Archive bone `#f2eade`** comes from the warm highlights in the portrait and the color of handled paper. It keeps long reading surfaces warmer than pure white.
- **Signal blue `#2852e8`** is the high-chroma computational color. Against the low-chroma midnight and bone field it has strong figure-ground separation. It passes AA with white and archive bone, and clears the 3:1 non-text threshold against portrait midnight. Blue is reserved for controls, active estimates, live status, and links that respond.
- **Smoke blue `#b9c0d8`** is the low-chroma bridge between portrait midnight and signal blue. It appears in editorial display type where a live control would be misleading.
- **St. Louis oxide `#ad4e35`** draws from the city's red-brick material field. It is used sparingly in the Third Space system.
- **River spruce `#184f48`** gives Third Space a distinct institutional field. The oxide/spruce relationship is a muted complementary pair; warm archive bone keeps both from becoming corporate green and orange.

Color never carries meaning by itself. Active states also change shape, border, label, or position. All body combinations target WCAG AA contrast or better.

## Type

- **Bodoni Moda** carries only the largest human claims. Its high contrast and optical-size axis give the site the editorial refinement appropriate to scholarship, without making body copy precious.
- **Newsreader** carries arguments, explanations, and long reading. It was designed for sustained screen reading.
- **Geist** carries instruction and interface prose.
- **Geist Mono** carries every coefficient, status, accession number, source label, and keyboard instruction.
- Third Space retains **Spectral**, **Hanken Grotesk**, and **Spline Sans Mono** as a related but independent venture voice.

Large type is a claim, not decoration. It is used for the sentence the page is prepared to defend.

## Motion

Motion has two licensed causes:

1. A real calculation is resolving.
2. A visitor changed the state.

The NMTC confidence intervals draw as the result resolves. The model path moves only when run. The teaching relay updates because the price changed. The Third Space overlap responds to a selected research seam. The public index responds to focus and filters. Ambient drift, parallax, looping ornaments, and decorative page fades are excluded. Reduced-motion mode removes every nonessential transition.

## Factual release gate

`npm run check:copy` blocks the known name conflation and common voice violations. Third Space Labs is co-founded by Ian Helfrich and Elizaveta Gonchar, Ph.D. Shane Vardanyan is Ian's student coauthor on the AI and entry-level labor project.
