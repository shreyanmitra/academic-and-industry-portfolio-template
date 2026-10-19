# BibTeX import (optional pybtex dependency).
import argparse
from pathlib import Path
from pybtex.database import parse_file
from generator import generate
import csv
import tempfile

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description='Import a BibTeX file into Academic Pages publication records.')
    parser.add_argument('bib_file')
    parser.add_argument('output_dir',nargs='?')
    args=parser.parse_args()
    bibliography=parse_file(args.bib_file)
    rows=[]
    for key,entry in bibliography.entries.items():
        fields=entry.fields
        year=fields.get('year')
        if not year: raise ValueError(f'Missing year for {key}')
        authors='; '.join(str(person) for person in entry.persons.get('author',[]))
        rows.append({'pub_date':f'{year}-01-01','title':fields.get('title',key),'venue':fields.get('journal',fields.get('booktitle','')),
                     'excerpt':fields.get('abstract',''),'citation':f'{authors} ({year}). {fields.get("title",key)}.',
                     'url_slug':key,'paper_url':fields.get('url',''),'slides_url':'','category':'manuscripts'})
    with tempfile.TemporaryDirectory() as directory:
        table=Path(directory)/'publications.csv'
        with table.open('w',encoding='utf-8',newline='') as stream:
            writer=csv.DictWriter(stream,fieldnames=list(rows[0]) if rows else ['pub_date','title','url_slug'])
            writer.writeheader();writer.writerows(rows)
        for path in generate('publications',table,args.output_dir): print(path.name)
