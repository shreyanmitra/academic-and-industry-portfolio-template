import csv
import importlib.util
import json
import subprocess
import sys
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('generator', ROOT/'markdown_generator/generator.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)

(ROOT/'local').mkdir(exist_ok=True)

class GeneratorTests(unittest.TestCase):
    def test_samples_and_quoted_unicode_titles(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'local') as directory:
            root = Path(directory)
            for kind in ('publications', 'talks'):
                paths = generator.generate(kind, ROOT/f'markdown_generator/{kind}.tsv', root/kind)
                self.assertEqual(len(paths), 1)
                self.assertIn(f'collection: "{kind}"', paths[0].read_text(encoding='utf-8'))
                with self.assertRaises(FileExistsError):
                    generator.generate(kind, ROOT/f'markdown_generator/{kind}.tsv', root/kind)
            data = root/'quoted.csv'
            title = 'Résumé: "quoted" & reproducible'
            with data.open('w',newline='',encoding='utf-8') as stream:
                writer=csv.DictWriter(stream,fieldnames=['pub_date','title','url_slug']);writer.writeheader();writer.writerow({'pub_date':'2026-01-01','title':title,'url_slug':'quoted'})
            result=generator.generate('publications',data,root/'quoted')[0].read_text(encoding='utf-8')
            self.assertIn(json.dumps(title,ensure_ascii=False),result)

    @unittest.skipUnless(importlib.util.find_spec('pybtex'), 'Optional pybtex dependency is not installed')
    def test_bibtex_import_and_no_overwrite(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'local') as directory:
            output=Path(directory)/'publications'
            command=[sys.executable,str(ROOT/'markdown_generator/pubsFromBib.py'),str(ROOT/'markdown_generator/example.bib'),str(output)]
            subprocess.run(command,check=True,capture_output=True)
            records=list(output.glob('*.md'))
            self.assertEqual(len(records),1)
            self.assertIn('Example Research Note',records[0].read_text(encoding='utf-8'))
            self.assertNotEqual(subprocess.run(command,capture_output=True).returncode,0)

    def test_invalid_batch_writes_nothing(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'local') as directory:
            root=Path(directory);data=root/'talks.tsv';output=root/'out'
            data.write_text('date\ttitle\turl_slug\n2026-01-01\tGood\tgood\n2026-01-01\tBad\t../escape\n')
            with self.assertRaises(ValueError): generator.generate('talks',data,output)
            self.assertFalse(output.exists())
            self.assertFalse((root/'escape.md').exists())

if __name__ == '__main__': unittest.main()
