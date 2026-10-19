# Attribution and dependencies

The engine is derived from the Academic Pages / Minimal Mistakes family of Jekyll sites. The upstream MIT copyright and permission notice is preserved verbatim in `LICENSE`.

- [Academic Pages](https://github.com/academicpages/academicpages.github.io): Jekyll portfolio conventions and upstream project.
- [Minimal Mistakes](https://github.com/mmistakes/minimal-mistakes), Michael Rose: upstream foundation; MIT notice in `LICENSE`.
- Jekyll and its plugins are installed from RubyGems using `Gemfile` / `Gemfile.lock`; their own licenses continue to apply. Dependency source and build caches are not included in this repository.
- The portrait and favicon are neutral SVG placeholders supplied with this starter under its MIT license. No photographs, personal logos, publication PDFs, or real CVs are bundled.
- Typography is requested from Google Fonts: Crimson Pro (SIL Open Font License) and DM Sans (SIL Open Font License), with system-font fallbacks. Font binaries are not redistributed here. To avoid third-party font requests, remove the Google Fonts `<link>` elements in `_layouts/portfolio.html`.
- If `talkmap: true` is enabled on the Talks page, Leaflet 1.9.4 (BSD-2-Clause) is loaded from unpkg, and the map requests Esri canvas tiles. The map shows tile-provider attribution. Review the provider's terms before using the map for your deployment. With the default `talkmap: false`, those map services are not loaded.

This template does not enable analytics, comments, tracking IDs, or verification tokens. Site owners should document any services they enable and keep required upstream notices when redistributing the engine.


The restored compatibility engine also includes the inherited Sass/JavaScript, jQuery, Academicons, and Font Awesome assets. Their upstream copyright/license headers are retained in source. Font Awesome Free uses its applicable icon/font/code licenses (CC BY / SIL OFL / MIT); Academicons uses its font and CSS licenses. See the notices in the inherited asset sources. The compatibility layer does not license third-party trademarks or user-supplied content.

MathJax, Mermaid and Plotly are fetched from public CDNs only for relevant content; those services receive normal resource requests. Comments, analytics, ORCID imports and geocoding require explicit configuration/use. No personal service accounts are configured in the starter. Legacy hooks for retired services are retained as compatibility source, not as a claim that those services remain available.
