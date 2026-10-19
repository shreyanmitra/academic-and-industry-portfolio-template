# Academic and Industry Portfolio Template

Planned public repository name: `academic-and-industry-portfolio-template`.

A standalone Jekyll starter for academic and industry portfolios. The reusable engine is included directly: no submodule or hosted editing account is required. JavaScript assets are supplied ready to use; rebuilding the inherited classic bundle is optional.

The starter contains **fictional examples**, a neutral placeholder portrait, and no configured contact accounts. Replace the examples before publishing. This repository is not a remote Jekyll theme: a copy owns its engine and content, and upstream improvements must be reviewed and applied manually.

See [the local review results and remaining publication checks](docs/REVIEW.md).

## Start locally

Install Ruby 3.3+ and Bundler. On Windows, use RubyInstaller with Devkit; see [Jekyll's Windows guide](https://jekyllrb.com/docs/installation/windows/).

```sh
bundle install
bundle exec jekyll serve --host 127.0.0.1
```

Open `http://127.0.0.1:4000`. Restart Jekyll after changing `_config.yml`. No Node installation is needed to build or publish the site.

## Make it yours

1. In `_config.yml`, set the title, description, `author.name`, short biography, optional contact/profile links, `url`, and `baseurl`.
2. In `_data/portfolio.yml`, edit the role, homepage introduction, affiliations, research areas, portrait paths, contact introduction, CV link, awards, and footer note.
3. Replace the biography and longer notes in the corresponding `_includes/portfolio-*-notes.html`, `portfolio-biography.html`, and `portfolio-research.html` files. These accept Markdown.
4. Replace or remove the fictional entries in `_projects`, `_publications`, `_experience`, `_teaching`, `_leadership`, `_talks`, `_portfolio`, `_posts`, and `_drafts`. Update `_data/cv.json` if you use the JSON CV page.
5. Edit navigation in `_data/navigation.yml` and skills, languages, and degrees in `_data/portfolio_skills.json`.
6. Replace `images/portrait.svg` and the favicon if desired. Put downloads in `files/`. Set `cv_url` to `/files/cv.pdf` only after adding that file; leaving it empty hides the download link.
7. Set `demo: false` in `_data/portfolio.yml` after personalizing the content, and update `_data/portfolio_ui.yml` when publishing changes.

Empty contact links are hidden. Project `tags` and the global skill cloud are separate lists. Arbitrary experience/leadership categories work without template edits.

## Publish on GitHub Pages

After the starter has been published as a GitHub template repository, choose **Use this template** to create an independent repository, or fork it. See [GitHub's template documentation](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository).

Configure the deployment address:

| Site | Repository | `url` | `baseurl` |
| --- | --- | --- | --- |
| Personal site | `USERNAME.github.io` | `https://USERNAME.github.io` | `""` |
| Project site | Any name, e.g. `portfolio` | `https://USERNAME.github.io` | `/portfolio` |
| Custom domain | Your chosen repo | `https://your-domain.example` | `""` |

The included deployment workflow reads the configured GitHub Pages address, so generated links and canonical URLs follow the actual publishing destination. Configure `url` and `baseurl` too for accurate local builds and other hosts.

In repository **Settings → Pages**, select **GitHub Actions** as the source. The deployment workflow runs on pushes to `main` or manual dispatch. Add a custom domain through Pages settings if needed. No personal access token is required; it uses GitHub's scoped deployment token and the `github-pages` environment. See [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Check changes

```sh
bundle exec ruby tests/source_contract.rb
bundle exec jekyll build --destination _site-root
bundle exec ruby scripts/verify.rb _site-root
bundle exec jekyll build --baseurl /academic-and-industry-portfolio-template --destination _site-project
bundle exec ruby scripts/verify.rb _site-project /academic-and-industry-portfolio-template
bundle exec ruby tests/edge_cases.rb
```

Optional browser checks also cover navigation, filters, mobile layouts, reduced motion, and no-JavaScript access:

```sh
npm install
npx playwright install chromium
npm run test:browser
```

Build `_site-root` and `_site-project` first using the commands above. Screenshots are saved under ignored `local/screenshots/`. To use installed Edge instead, set `PORTFOLIO_BROWSER_CHANNEL=msedge` in your shell.

CI runs the Ruby checks for pull requests and pushes. The rendered checks cover local links and anchors, images, metadata, base paths, one main heading per page, and accidental publication of development files. The edge-case build checks empty collections and missing optional content. These checks do not fetch external URLs.

## Optional Portfolio Studio editor

Portfolio Studio stays in its own repository. Point it at this starter with:

```powershell
./start-portfolio-studio.ps1 -Site C:\path\to\academic-and-industry-portfolio-template
```

Run that command from the editor folder. Studio manages collections, project tags, grouped skills, navigation, media, and selected shared-content files. It reviews saves and keeps previous-byte backups outside the website. It does not publish to GitHub. You can always edit Markdown/YAML/JSON directly; the site works independently of Studio. See [the editing guide](docs/EDITING.md).

## What's included

- Responsive redesigned portfolio with a default dark appearance, persistent light/dark switching, six palette settings, mobile navigation, and reduced-motion support.
- Collection archives/details, optional structured publication panels, project and skills filters, optional animated portraits, and an opt-in talk map.
- Configurable personal copy, generated and JSON CV pages, HTML/XML sitemaps, and an RSS feed.
- Inherited Academic Pages layouts, profile sidebars, original `_portfolio` collection, blog/drafts/year/category/tag archives, and pagination.
- MathJax, Mermaid, Plotly, expanded author settings, galleries, feature rows, table of contents, and the original integration hooks.
- CSV/TSV/BibTeX/ORCID content tooling and optional Docker / Dev Container setup.
- GitHub Pages deployment and validation workflows; analytics and comments remain disabled by default.

Google Fonts is used for typography with system fallbacks. The optional talk map loads Leaflet and Esri tiles only when enabled. See [NOTICE.md](NOTICE.md) for attribution and third-party-service details, and [docs/CONTENT.md](docs/CONTENT.md) for the content schema.


## Restored Academic Pages functionality

The redesigned homepage is still the default. See [the feature restoration matrix](docs/FEATURE-PARITY.md) for the inherited engine, exact locations, test coverage, and external-service boundaries.

- `/year-archive/` lists posts, `/blog/` adds pagination, and `/categories/` / `/tags/` provide taxonomy archives.
- `/cv/` builds a CV from your collections and education. `/cv-json/` reads `_data/cv.json`; `/resume/` retains the optional download.
- `/portfolio/` preserves the original `_portfolio` collection alongside redesigned `_projects`.
- `/classic/` demonstrates `layout: single` with the inherited sidebar. Other retained layouts include `archive`, `archive-taxonomy`, `talk`, and `splash`.
- `/markdown/` demonstrates real MathJax, Mermaid and Plotly rendering. These use public CDNs on pages with relevant content. Source remains readable without JavaScript.
- `site_theme` selects `default`, `air`, `sunrise`, `mint`, `dirt`, or `contrast`. Classic layouts retain their palette styling; redesigned layouts retain their design with corresponding accent variants. `appearance.default` and `appearance.toggle` control the redesigned theme switch.

Additional verification:

```sh
bundle exec ruby tests/inherited.rb
python -m unittest discover -s tests -p 'test_*.py'
npm run test:features
```

The optional feature browser check loads the public math/chart/diagram libraries to verify actual rendering. It submits no forms or analytics events. External services and retired legacy integrations require separate owner configuration; see the matrix.

Optional containers:

```sh
docker compose up --build
```

The site is bound to `127.0.0.1:4000`. A VS Code Dev Container configuration is included. These require a working Docker engine; Docker was not available in the local verification environment.

The inherited classic JavaScript bundle is already included. To rebuild it after changes, run `npm install` and `npm run build:js`. Python tooling dependencies are separate in `requirements-tools.txt` and are not needed for normal site builds.
