# Content schema

All collection records are Markdown with YAML front matter. `title` and `date` describe a record; `collection` names its folder without the underscore. Use a unique `permalink` or rely on the configured collection permalink. The supplied validation expects explicit permalinks so collisions are visible.

```yaml
---
title: "My project"
collection: projects
permalink: /projects/my-project/
date: 2026-01-15
portfolio_category: Research tools
featured: true
summary: "A short description of the problem and contribution."
tags: [Python, Data analysis]
# Optional: icon: /images/project.svg
# Optional: codeurl: https://example.org/code
---
```

Write the body below the closing `---`. It appears on the detail page. Cards use `summary`, falling back to the beginning of the body. Dates sort newest first. `featured: true` selects projects for the homepage; no featured projects produces a link to the full archive.

| Collection | Fields used beyond the common title/date/summary |
| --- | --- |
| Projects | `featured`, `tags`, `portfolio_category`, optional `codeurl` |
| Publications | `venue`, `citation`, `paperurl`, `codeurl`, optional structured panels below |
| Experience | `role`, `venue`, `location`, `finished`, `portfolio_category` |
| Teaching | `venue`, `location`, `portfolio_category`, optional `award` text |
| Leadership | `portfolio_category`, `venue`, `location` |
| Talks | `venue`, `location`, `slidesurl`, `videourl`, optional numeric `latitude` / `longitude` |

`role` and `finished` are available metadata but are not separate display lines: put the role in `title` and mention a date range in the body if needed. `icon` or `header.teaser` is optional for every collection. Use a site-root path for local media, e.g. `/images/project.svg`. External HTTPS images also work. Bare icon filenames resolve under `/images/` for Academic Pages compatibility.

## Publications

Use ordinary Markdown for a simple paper page. For richer panels, make the body:

```liquid
{% include portfolio-publication-detail.html %}
```

Optional front-matter blocks:

- `glance`: `venue_tags` (list), `status`, `part_of` (list), `topic` (list), `associated_with` (list of `{name, url, logo}`), `versions`, `has_code`, `has_dataset`, and `separate_papers`.
- `quick_access`: list of `{label, url}` resources. Omit a URL to display an unavailable resource.
- `preview`: `excerpt_note`, `excerpt`, `citation_note`, `citation`, plus `code` / `datasets` resource lists.
- `history`: `versions` (list of citation strings) and `archived_code` (resource list). An empty mapping shows the no-previous-versions message.

Omit any top-level block to hide its entire panel. The included example demonstrates the structure. Local resource paths receive `baseurl` automatically.

## Navigation

`_data/navigation.yml` has a `main` list:

```yaml
main:
  - title: Projects
    section: projects           # homepage anchor
  - title: Experience
    section: experience         # active state for archive/detail
    url: /experience/           # standalone page destination
  - divider: true
  - title: Contact
    section: contact
    style: button
```

A button entry targets its homepage `section`. Normal links can have a `url`, a `section`, or both. Use section identifiers that exist on the homepage. For external links, use a full HTTPS URL.

## Skills

`_data/portfolio_skills.json` contains `groups: [{name, skills: []}]`, `languages: []`, and `degrees: []`. Categories power the skill-cloud filters. Project `tags` are independent; editing one does not silently change the other.

## Portraits, CV and map

Set homepage portrait paths and alt text in `_data/portfolio.yml`. The still image is the accessible/no-JavaScript/reduced-motion fallback. Optional WebM and animated WebP paths enable animation. Leaving an animation path blank causes no request for it. Set `portrait.image: ""` to omit the portrait entirely.

Set `cv_url` to an existing local file such as `/files/cv.pdf` or a complete HTTPS URL. Without it, the CV page shows setup guidance and download controls are hidden.

To enable the optional talk map, set `talkmap: true` on `_pages/talks.html` and add numeric coordinates to one or more talk records. No map is emitted without coordinates; talk text remains available without JavaScript or network access.

## Empty and unpublished content

Deleting the sample records leaves working archives with empty-state messages. Setting `published: false` on a record omits it from a normal build. Future-dated content is hidden unless `future: true` is configured. A missing category still appears in experience, teaching, and leadership archives.


## Inherited collections and layouts

The original `_portfolio` collection is supported alongside `_projects`. Blog posts go in `_posts/YYYY-MM-DD-slug.md`; drafts go in `_drafts` and require `--drafts` for preview. Posts use the inherited `single` layout with taxonomy links, read time, sharing, optional comments, and related-post helpers. Use `layout: single`, `archive`, `archive-taxonomy`, `talk`, or `splash` explicitly when migrating classic pages.

Math uses normal Kramdown/MathJax delimiters. Fenced `mermaid` blocks contain diagram definitions; fenced `plotly` blocks contain JSON with `data` and optional `layout`. The guide at `/markdown/` contains working examples. Disable the redesigned loaders with the corresponding `academic_features` flags if desired.

`/cv/` reads the collections and skills/education data automatically. `/cv-json/` uses `_data/cv.json`, whose neutral sample has basics/work/education/publications/awards/volunteer/skills/languages/interests/references sections. Neither requires deleting the existing résumé download page.
