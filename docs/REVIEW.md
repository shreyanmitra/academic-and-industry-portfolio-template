# Validation and contributor checks

Run these checks before submitting engine changes or deploying a customized site. The validation workflow runs source, rendered-site, edge-case, inherited-feature, and content-generator checks on pushes and pull requests.

## Site builds

Install the dependencies with `bundle install`, then run:

```sh
bundle exec ruby tests/source_contract.rb
bundle exec jekyll build --destination _site-root
bundle exec ruby scripts/verify.rb _site-root
bundle exec jekyll build --baseurl /academic-and-industry-portfolio-template --destination _site-project
bundle exec ruby scripts/verify.rb _site-project /academic-and-industry-portfolio-template
bundle exec ruby tests/edge_cases.rb
bundle exec ruby tests/inherited.rb
```

The rendered checks cover local links, anchors, images, metadata, heading structure, base paths, and development-file exclusions. Edge-case fixtures cover empty collections and optional content. Inherited-feature fixtures exercise palettes, pagination, CVs, feeds, and integration hooks. These checks do not validate external URLs or live service accounts.

## Browser checks

After building both output directories above:

```sh
npm install
npx playwright install chromium
npm run test:browser
npm run test:features
```

Set `PORTFOLIO_BROWSER_CHANNEL=msedge` to use installed Edge. The checks cover desktop/mobile navigation, filters, no-JavaScript access, reduced motion, themes, and visualization rendering. The feature check requires access to public MathJax, Mermaid, and Plotly CDNs. Screenshots are written under ignored `local/` directories.

## Content import checks

```sh
python -m pip install "pybtex>=0.24,<1"
python -m unittest discover -s tests -p 'test_*.py'
```

The optional BibTeX test is skipped when pybtex is unavailable. Other generator tests use Python's standard library.

## Before deploying

Replace sample content, check contact and download links, review any enabled external services, and preview desktop/mobile layouts. Confirm that the GitHub Pages workflow succeeds and that navigation works at your hosted address. Docker and Dev Container changes should also be exercised with a working Docker engine.

Build caches and local screenshots are ignored. Share source files through Git rather than uploading the entire working directory; generated caches can contain local filesystem paths.
