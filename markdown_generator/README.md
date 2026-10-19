# Academic Pages content generators

Use Python 3.10+ for CSV/TSV imports. The publication and talk scripts use only the standard library.

```sh
python markdown_generator/publications.py markdown_generator/publications.tsv
python markdown_generator/talks.py markdown_generator/talks.tsv
```

An optional second argument selects an output directory. Existing files are never overwritten; invalid records reject the batch before writes. Replace the example tables with your own metadata. Publication input accepts the original pub_date/title/venue/excerpt/citation/url_slug/paper_url/slides_url columns and optional category. Talk input uses date/title/url_slug/type/venue/location/talk_url/description. CSV and TSV both work.

Jupyter notebooks are optional interfaces. Install `requirements-tools.txt` for BibTeX, ORCID, notebook and geocoding utilities. Use `python markdown_generator/pubsFromBib.py markdown_generator/example.bib [output_dir]` for BibTeX import. Its optional dependency is pybtex; the included bibliography is fictional. The ORCID notebook requires your own identifier and network access. These utilities are never invoked by a normal site build.

The inherited `talkmap.py` / notebook geocode talk locations using an external service and generate the standalone map under `talkmap/`. Review inputs and provider terms before running them. The redesigned map instead uses explicit coordinates in talk metadata and requires no geocoding step.
