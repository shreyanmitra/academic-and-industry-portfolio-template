# Academic and Industry Portfolio Template

https://shreyanmitra.github.io/academic-and-industry-portfolio-template/

A customizable Jekyll portfolio for researchers, academics, and industry professionals. Present your publications, projects, work experience, teaching, and writing in one place.

Built on [Academic Pages](https://github.com/academicpages/academicpages.github.io) and [Minimal Mistakes](https://github.com/mmistakes/minimal-mistakes), with a modern portfolio interface and classic layouts available alongside it.

<img width="1777" height="897" alt="image" src="https://github.com/user-attachments/assets/ed1c0763-e649-49de-8237-ab7ac797127b" />
<img width="1700" height="880" alt="image" src="https://github.com/user-attachments/assets/e42ae246-0717-4994-b574-eb0121964061" />



## Features

- Responsive design with light/dark switching, six color palettes, and reduced-motion support.
- Publications, filterable projects and skills, experience, teaching, talks, and leadership sections.
- Generated and JSON-based CV pages, plus an optional résumé download.
- Blog posts, drafts, categories, tags, pagination, and RSS.
- MathJax equations, Mermaid diagrams, Plotly charts, and an optional talk map.
- Classic Academic Pages layouts, author sidebars, galleries, and table-of-contents helpers.
- Bundled Portfolio Studio editor with save previews and restoration history.
- GitHub Pages deployment, automated validation, and optional Docker development.

The engine and content live together in your repository. No submodule or editing service is required. Sample content is fictional; replace it before publishing your own portfolio.

## Get started

1. Select **Use this template** on GitHub to create your repository, or fork the project.
2. Name it `USERNAME.github.io` for a personal site, or choose any name for a project site.
3. Personalize the files below.
4. In **Settings → Pages**, select **GitHub Actions** as the publishing source. Push to `main` or run the Pages workflow manually to deploy.

### Personalize your portfolio

| What to change | Where |
| --- | --- |
| Name, biography, contact links, website address | `_config.yml` |
| Homepage introduction, role, portrait, affiliations, awards | `_data/portfolio.yml` |
| Biography and section introductions | `_includes/portfolio-biography.html`, `portfolio-research.html`, and `portfolio-*-notes.html` |
| Publications, projects, experience, teaching, leadership, talks | Matching collection folders, such as `_projects` and `_publications` |
| Classic portfolio, blog posts, drafts | `_portfolio`, `_posts`, `_drafts` |
| Navigation | `_data/navigation.yml` |
| Skills, languages, education | `_data/portfolio_skills.json` |
| JSON-based CV | `_data/cv.json` |
| Images and downloads | `images/` and `files/` |
| Footer update date | `_data/portfolio_ui.yml` |

Replace or remove all example entries and placeholder assets. To offer a downloadable CV, add the file and set `cv_url` in `_data/portfolio.yml`, for example `/files/cv.pdf`. Empty contact links and CV download controls are hidden.

Set `demo: false` in `_data/portfolio.yml` when your content is ready. Choose `site_theme` in `_config.yml`: `default`, `air`, `sunrise`, `mint`, `dirt`, or `contrast`. The `appearance` settings control the modern interface's default mode and theme switch.

### Set your website address

| Deployment | `url` | `baseurl` |
| --- | --- | --- |
| `USERNAME.github.io` repository | `https://USERNAME.github.io` | `""` |
| Project repository named `portfolio` | `https://USERNAME.github.io` | `/portfolio` |
| Custom domain | `https://your-domain.example` | `""` |

The Pages workflow uses the address configured in GitHub Pages when building deployment links. Keep `_config.yml` accurate for local previews and other hosts. Configure custom domains in GitHub Pages settings.

The default `baseurl` is `/academic-and-industry-portfolio-template`. Change it to match your repository name, or set it to `""` for a personal-site repository or custom domain.

### Links open another site or miss the repository path

A link such as `/projects/` goes to the account's root website. For a project site it must include the repository prefix, such as `/academic-and-industry-portfolio-template/projects/`. Confirm that **Settings → Pages → Source** is **GitHub Actions**, then run **Deploy GitHub Pages** from the Actions tab. A successful built-in **pages build and deployment** run does not establish that the custom workflow ran.

If you choose a branch-based deployment instead, configure both `url` and `baseurl` explicitly before publishing. The custom workflow's automatic address configuration applies only when that workflow builds the site.


## Edit with Portfolio Studio

The `editor/` folder contains a local editing app. On Windows, install Python 3.10+ and double-click `editor/portfolio-studio.cmd`. On macOS/Linux, follow the [editor setup guide](editor/README.md). It opens this repository by default.

Studio edits content, settings, skills, navigation, media, and selected shared templates. Saves include a difference preview and restore history; private backups stay outside the repository. The editor is excluded from GitHub Pages output. Use Jekyll to preview the final website, then commit and publish through your usual workflow.

## Preview locally

Install Ruby 3.3+ and Bundler. Windows users can follow [Jekyll's installation guide](https://jekyllrb.com/docs/installation/windows/).

```sh
bundle install
bundle exec jekyll serve --host 127.0.0.1
```

Open `http://127.0.0.1:4000/academic-and-industry-portfolio-template/` with the default configuration. If you change `baseurl`, use that path instead. Restart Jekyll after editing `_config.yml`. Node.js and Python are not required for a normal site build.

Alternatively, with Docker installed:

```sh
docker compose up --build
```

The preview is available at `http://127.0.0.1:4000`. A VS Code Dev Container configuration is also included.

## Guides

- [Content fields, collections, media, and maps](docs/CONTENT.md)
- [Editing and maintaining your site](docs/EDITING.md)
- [Academic Pages features and compatibility](docs/FEATURE-PARITY.md)
- [Validation and contributor checks](docs/REVIEW.md)
- [CSV, TSV, BibTeX, and ORCID content tools](markdown_generator/README.md)

The sample site includes `/markdown/` for equations and visualizations, `/classic/` for the classic layout, `/blog/` for posts, and `/cv/` and `/cv-json/` for the two CV options.

## Updates and attribution

Sites created from this template own their content and engine. Updates are applied manually; review upstream changes before merging them into your site.

Distributed under the [MIT license](LICENSE). Preserve the license and [attribution notices](NOTICE.md) when redistributing. Google Fonts and optional visualization/map services load external resources; analytics and comments are disabled until configured.
