# Extractable components

## SiteShell
- Source: `src/layouts/Base.astro`
- Category: layout
- Description: Global header, navigation, footer, metadata, and content shell.
- Extractable props: `title`, `description`, `wide`, `noindex`, `pageClass`
- Hardcoded: identity text, primary/secondary route labels, footer groups, accessibility behavior

## SiteIndex
- Source: `src/components/SiteIndex.astro`
- Category: layout
- Description: Global command-palette navigation and record search.
- Extractable props: open/closed state only
- Hardcoded: route registry and keyboard interaction model

## FieldRail
- Source: `src/components/FieldRail.astro`
- Category: layout
- Description: Shared route-context rail and progress surface.
- Extractable props: page landmarks and active section
- Hardcoded: rail geometry and motion behavior

## CaseRecord
- Source: `src/components/CaseRecord.astro`
- Category: basic
- Description: Evidence record with question, plain-language purpose, role, contribution, result, limit, and links.
- Extractable props: all record content and action URLs
- Hardcoded: semantic section order and typography classes

## OptimalTransportAperture
- Source: `src/components/OptimalTransportAperture.astro`
- Category: basic
- Description: Interactive optimal-transport visualization with restrained diagnostics.
- Extractable props: input distributions and explanatory copy
- Hardcoded: interaction logic, accessibility model, color semantics

## LeastSquaresLab
- Source: `src/components/LeastSquaresLab.astro`
- Category: basic
- Description: Interactive regression surface with draggable observations and model readout.
- Extractable props: initial points and captions
- Hardcoded: numerical logic, gesture rollback, SVG accessibility

## ResearchGraph
- Source: `src/components/ResearchGraph.astro`
- Category: basic
- Description: Interactive network of research questions, methods, and public records.
- Extractable props: node/edge data and selected record
- Hardcoded: force layout and motion/accessibility behavior
