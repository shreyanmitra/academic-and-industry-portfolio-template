"""Shared standard-library CSV/TSV importer for Academic Pages collections."""
import csv
import datetime as dt
import json
import re
from pathlib import Path


def generate(kind, input_file, output_dir=None):
    source = Path(input_file)
    destination = Path(output_dir) if output_dir else Path(__file__).resolve().parent.parent / ('_' + kind)
    with source.open(encoding='utf-8-sig', newline='') as stream:
        rows = list(csv.DictReader(stream, delimiter=',' if source.suffix.lower() == '.csv' else '\t'))
    if not rows:
        raise ValueError('The input needs a header and at least one record.')
    planned = []
    paths = set()
    for row in rows:
        title = row.get('title', '').strip()
        slug = row.get('url_slug', '').strip()
        date = row.get('pub_date' if kind == 'publications' else 'date', '').strip()
        if not title or not re.fullmatch(r'[A-Za-z0-9_-]+', slug):
            raise ValueError('Every row needs a title and a simple URL slug (no paths).')
        dt.date.fromisoformat(date)
        path = destination / f'{date}-{slug}.md'
        if path in paths or path.exists():
            raise FileExistsError(f'Record already exists: {path.name}. No records were written.')
        paths.add(path)
        meta = {'title': title, 'collection': kind, 'date': date,
                'permalink': f'/{"publication" if kind == "publications" else "talks"}/{date}-{slug}'}
        for field in ['venue', 'location', 'excerpt', 'citation']:
            if row.get(field, '').strip():
                meta[field] = row[field].strip()
        for field in ['paper_url', 'slides_url', 'talk_url']:
            if row.get(field, '').strip():
                meta[{'paper_url':'paperurl','slides_url':'slidesurl','talk_url':'link'}[field]] = row[field].strip()
        category = row.get('category', '').strip() or row.get('type', '').strip()
        if category:
            meta['portfolio_category'] = category
            meta['category' if kind == 'publications' else 'type'] = category
        body = row.get('description', '').strip() or row.get('excerpt', '').strip()
        # JSON strings are valid YAML scalars and safely preserve Unicode and quotes.
        front = '\n'.join(f'{key}: {json.dumps(value, ensure_ascii=False)}' for key, value in meta.items())
        planned.append((path, f'---\n{front}\n---\n\n{body}\n'))
    destination.mkdir(parents=True, exist_ok=True)
    for path, text in planned:
        with path.open('x', encoding='utf-8') as stream:
            stream.write(text)
    return [path for path, _ in planned]
