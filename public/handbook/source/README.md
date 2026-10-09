# Editable handbook source

Run `quarto render --to pdf` from this directory. Quarto and XeLaTeX are required; automatic TeX installation is disabled. The reference build uses Quarto 1.10.18, TeX Live 2026, US Letter, 12-point embedded Source Sans 3, one-inch margins, and page numbers. DejaVu Sans supplies the four reading-level glyphs; its license is included. Latin Modern supplies mathematical and code fonts under its included GUST licenses.

Chapter-local links and links to available handbook chapters become PDF destinations. Other root-relative web links become full online URLs. The `../figures/*-print.pdf` files are original vector print figures with enlarged labels and vertically arranged panels. The neighboring `code` directory contains the controlled fixtures, manifests and independent implementations. Web Markdown is in `chapters/`; the Astro files are source for integration with Ian Helfrich's existing site, not a standalone replacement site.

This working edition contains two foundation chapters. It is not the complete seventy-two-chapter handbook. Live assessments and grading keys are excluded.
