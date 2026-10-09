# Editable handbook source

Run `quarto render --to pdf` from this directory. Quarto and XeLaTeX are required; automatic TeX installation is disabled. The reference build uses Quarto 1.10.18, TeX Live 2026, US Letter, 12-point embedded Source Sans 3, one-inch margins, and page numbers. DejaVu Sans supplies the four reading-level glyphs; its license is included. Latin Modern supplies mathematical and code fonts under its included GUST licenses.

Chapter-local links become PDF destinations. Root-relative web links become full online URLs. `../figures/alert-worlds-print.pdf` is the original vector print figure with enlarged labels and vertically arranged panels. The neighboring `code` directory contains the controlled fixture, manifest and independent implementations. Web Markdown is in `chapters/01-questions.md`; the Astro files are source for integration with Ian Helfrich's existing site, not a standalone replacement site.

This working edition contains one foundation chapter. It is not the complete seventy-two-chapter handbook. Live assessments and grading keys are excluded.
