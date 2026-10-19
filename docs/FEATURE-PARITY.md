# Academic Pages feature restoration

The redesigned homepage remains the default. The inherited engine is retained alongside it; this is a compatibility restoration, not a promise that every upstream service is still available.

Baseline: the inherited Academic Pages / Minimal Mistakes engine, cross-checked against Academic Pages commit `7b958332ce9970cfb6987a049d7684ac615397e8`. This template retains Jekyll 3.10 for compatibility with the installed portfolio engine. It does not silently upgrade to upstream Jekyll 4.4 or replace the redesigned interface.

| Capability | Location and verification |
| --- | --- |
| Blog, drafts, feed, year/category/tag archives | `_posts`, `_drafts`, `/year-archive/`, `/categories/`, `/tags/`, `/feed.xml`; rendered checks and feed tests |
| Paginated blog | `/blog/`, `paginate` / `paginate_path`; multi-page fixture and base-path link checks |
| Original portfolio collection | `_portfolio`, `/portfolio/`; classic sample and generated-CV tests |
| Classic page layouts | `single`, `archive`, `archive-taxonomy`, `talk`, `splash`, `compress`, `default`; inherited includes, Sass, icons, and JavaScript retained |
| Profile sidebar and expanded account fields | `author` settings and `_data/authors.yml`; classic example at `/classic/` |
| Generated CV | `/cv/` gathers existing collections and education; `/resume/` still supports a separate download |
| JSON CV | `/cv-json/` reads `_data/cv.json` without requiring a duplicate page template |
| Light/dark and palettes | Theme control; `site_theme` accepts default, air, sunrise, mint, dirt, contrast. Classic palettes retain inherited styles. Modern layouts keep their design and use corresponding accent variants. |
| MathJax, Mermaid, Plotly | `/markdown/` and `/classic/` guides and actual browser rendering checks; scripts load only on relevant content |
| Comments, analytics, verification | Original provider includes/configuration retained; disabled by default; custom-hook and opt-out fixture tests |
| Galleries, feature rows, TOC, breadcrumbs, sidebars, sharing, post navigation | Inherited includes retained; select classic layouts for their original markup/styles |
| Gist, emoji, pagination plugins | Restored Gemfile/configuration; neutral emoji and paginated-blog examples |
| Content generators | CSV/TSV scripts, BibTeX/ORCID notebooks; standard-library CSV/TSV and optional BibTeX generator tests; external import services are optional |
| Talk maps | `/talkmap.html` uses coordinates or an optional generated standalone map; inherited geocoding tooling retained; map fixtures verify coordinate output |
| Docker / Dev Container | Dockerfile, Compose, and Dev Container configuration restored; normal Ruby startup remains available |

## Compatibility boundaries

- The template and classic engine share content and configuration. Existing Academic Pages records can use their inherited layouts explicitly (`layout: single`, for example). Redesigned project cards live in `_projects`; the original `_portfolio` collection is also supported.
- Provider hooks are preserved, but live Disqus, analytics, Staticman, ORCID and geocoding services require owner configuration and network access. Automated checks do not send comments, analytics events, or authenticated requests. Google+ and other retired integrations remain inherited legacy code, not working-service guarantees.
- Optional scripts and notebooks keep external dependencies listed in `requirements-tools.txt`; they are excluded from published site output. Docker configuration requires a Docker engine and should be validated on the deployment machine.
- Fresh GitHub-hosted Actions deployment is still pending publication. Local Windows builds, link checks, browser checks and fixtures do not establish that a remote deployment has already succeeded.

Keep `LICENSE` and `NOTICE.md` when distributing this engine. No personal portfolio records, photos, account identifiers, or old repository history are included.
