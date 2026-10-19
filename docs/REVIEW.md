# Template review — 2026-10-19

Public repository name: `academic-and-industry-portfolio-template`.
Display name: **Academic and Industry Portfolio Template**.
The engine is included directly in the independent template repository.

## Review outcome

The local starter is ready for the GitHub publication stage. This review did not create a remote repository, enable GitHub settings, or deploy a site.

Reviewed the default desktop/mobile design, neutral sample content, setup and editing instructions, inherited feature matrix, and release packaging. The redesigned homepage remains the default; classic Academic Pages layouts and academic writing tools remain available.

Changes from this review:

- Applied the chosen public name to the README, package metadata, project-path validation, and browser checks.
- Expanded the personalization checklist to cover original portfolio entries, posts, drafts, and JSON CV examples.
- Made Plotly chart backgrounds and text follow light/dark switching while respecting explicit author colors.
- Corrected import-test file decoding to use UTF-8 consistently on Windows.

## Verified locally

- Source contract: 30 sample pages and collection records.
- Root and proposed project-path builds: 36 HTML pages and 2,545 rendered conditions each.
- Edge cases: empty collections, missing portrait/CV, category-free roles, optional coordinate map.
- Inherited functionality: six palettes, pagination, sidebar, CV/feed, analytics opt-out, custom integration hooks, and verification settings; fixture build checked 3,087 conditions across 43 pages.
- Browser checks: desktop/mobile, root/project navigation, filters, no JavaScript, reduced motion, persistent themes, and actual MathJax/Mermaid/Plotly rendering, including chart theme changes.
- Content tooling: all three CSV/TSV/BibTeX import tests passed.
- Publishable-file scan: no personal identifiers or local machine paths; inherited vendor Sass is included.
- Inspected desktop homepage, mobile light appearance, and rendered writing-guide screenshots.

## Remaining publication checks

Create the separate public GitHub repository with the chosen name and enable **Template repository**. Run its GitHub Actions checks, then create a disposable site using **Use this template** and validate the hosted result before announcing a release.

Docker/Dev Container execution and owner-configured external services remain unverified. Local builds do not establish that GitHub deployment settings are correct. These boundaries are also recorded in FEATURE-PARITY.md.
