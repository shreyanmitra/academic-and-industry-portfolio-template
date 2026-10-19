# Editing and maintenance

The template is a normal Jekyll repository with its engine included. A site created with GitHub's template button has independent history; it does not automatically receive engine updates. Forks also require an explicit merge/review of upstream changes.

## Main editing locations

| Content | File |
| --- | --- |
| Name, short bio, contact accounts, site URL | `_config.yml` |
| Homepage role, introduction, affiliations, research cards, portraits, awards, CV | `_data/portfolio.yml` |
| Long biography | `_includes/portfolio-biography.html` |
| Longer research explanation | `_includes/portfolio-research.html` |
| Archive introductions | `_includes/portfolio-project-notes.html`, `portfolio-publication-notes.html`, `portfolio-talk-notes.html` |
| Menu | `_data/navigation.yml` |
| Skills, languages, degrees | `_data/portfolio_skills.json` |
| Publication date in footer | `_data/portfolio_ui.yml` |
| Entries | Collection folders, e.g. `_projects` |
| Colors and visual styling | `assets/css/portfolio.css` |
| Shared page shell | `_layouts/portfolio.html` |

Edit Markdown, YAML, and JSON with your preferred text editor. Preview with Jekyll to render Liquid templates and confirm the final layout. If you use a separate content editor, keep its private history and backups outside the public site repository.

## Upgrading an existing portfolio

Do not replace an existing website wholesale. Work in a separate checkout, map its collections and front matter to this schema, copy public content and media deliberately, and compare rendered pages. Check publication links, CV downloads, metadata, accessibility, mobile layouts and project-site base paths before changing any live deployment.

## Before publishing

Replace all fictional examples, placeholder degrees/languages/awards, the portrait, and favicon as appropriate. Review contact destinations and optional external services. Disable the sample banner with `demo: false`, run the documented checks, and preview the result. Keep `LICENSE` and `NOTICE.md` in distributed source copies.

To distribute your own reusable starter, enable **Template repository** in its GitHub settings. To publish a site, select **GitHub Actions** in **Settings → Pages**.
