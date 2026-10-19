import base64
import copy
import json
import unittest
from pathlib import Path

import test_core
from portfolio_studio.core import ConflictError, StudioError, SITE_COPY, SKILLS_PATH


class ModernPortfolioTests(unittest.TestCase):
    setUp = test_core.PortfolioStudioTests.setUp
    tearDown = test_core.PortfolioStudioTests.tearDown
    def modern_site(self):
        (self.root / '_experience').mkdir(exist_ok=True)
        (self.root / '_experience' / 'role.md').write_text('---\ntitle: Engineer\ncollection: experience\n---\n\nBuilt tools.\n', encoding='utf-8')
        (self.root / '_layouts').mkdir(exist_ok=True)
        (self.root / '_layouts' / 'portfolio-home.html').write_text('---\nlayout: portfolio\n---\n\n<h1>Résumé</h1>\n', encoding='utf-8')
        (self.root / '_includes').mkdir(exist_ok=True)
        (self.root / '_includes' / 'portfolio-biography.html').write_bytes(b'Hello!\r\n\r\n{% include example.html %}\r\n')
        value = {'groups':[{'name':'Research','skills':['Python'], 'extra':True}], 'languages':['English'], 'degrees':['BSc'], 'custom':'preserve'}
        (self.root / SKILLS_PATH).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
        return value

    def test_template_homepage_data_is_editable_and_reversible(self):
        self.modern_site()
        path = '_data/portfolio.yml'
        (self.root / path).write_text('role: Researcher\nportrait:\n  image: /images/example.svg\n', encoding='utf-8')
        self.assertTrue(self.site.bootstrap()['capabilities']['homepageData'])
        group = next(group for group in self.site.content_groups() if group['key'] == 'sitecopy')
        self.assertTrue(any(item['path'] == path for item in group['items']))
        doc = self.site.document(path)
        preview = self.site.preview_document(path, {}, doc['body'].replace('Researcher', 'Developer'), doc['hash'])
        saved = self.site.apply_preview(preview, 'Homepage settings')
        self.assertTrue(self.site.document(path)['body'].startswith('role: Developer'))
        self.site.revert(saved['change']['id'])
        self.assertEqual(self.site.document(path)['hash'], doc['hash'])

    def test_experience_and_shared_content_discovered(self):
        self.modern_site()
        groups = {g['key']:g for g in self.site.content_groups()}
        self.assertEqual(groups['experience']['count'], 1)
        self.assertTrue(groups['sitecopy']['fixed'])
        self.assertTrue(self.site.bootstrap()['capabilities']['modernSkills'])

    def test_raw_shared_content_no_front_matter_added_and_restore_exact(self):
        self.modern_site()
        path = '_includes/portfolio-biography.html'
        before = (self.root / path).read_bytes()
        doc = self.site.document(path)
        self.assertFalse(self.site.preview_document(path, {}, doc['body'], doc['hash'])['changed'])
        preview = self.site.preview_document(path, {}, doc['body'].replace('Hello!', 'Welcome!'), doc['hash'])
        after = base64.b64decode(preview['payload'])
        self.assertEqual(after, before.replace(b'Hello!', b'Welcome!'))
        saved = self.site.apply_preview(preview, 'Biography')
        self.site.revert(saved['change']['id'])
        self.assertEqual((self.root / path).read_bytes(), before)

    def test_shared_content_conflicts_and_delete_blocked(self):
        self.modern_site()
        path = '_includes/portfolio-biography.html'
        doc = self.site.document(path)
        with self.assertRaises(StudioError): self.site.preview_delete(path, doc['hash'])
        (self.root / path).write_text('External edit', encoding='utf-8')
        with self.assertRaises(ConflictError): self.site.preview_document(path, {}, 'Mine', doc['hash'])
        with self.assertRaises(StudioError): self.site.resolve('_includes/seo.html', writable=True)
        with self.assertRaises(StudioError): self.site.resolve('_layouts/single.html', writable=True)

    def test_skills_update_restore_preserves_unknown_fields(self):
        original = self.modern_site()
        snap = self.site.skills()
        self.assertFalse(self.site.preview_skills(original, snap['hash'])['changed'])
        value = copy.deepcopy(original)
        value['groups'][0]['skills'].append('C++')
        saved = self.site.apply_preview(self.site.preview_skills(value, snap['hash']), 'Skills')
        self.assertEqual(self.site.skills()['value'], value)
        self.site.revert(saved['change']['id'])
        self.assertEqual(self.site.skills()['value'], original)

    def test_skills_invalid_or_stale_data_rejected(self):
        value = self.modern_site()
        snap = self.site.skills()
        for invalid in [None, [], {}, {'groups':[{}]}, {'groups':[{'name':'x','skills':[2]}]}, {'groups':[], 'languages':'English'}]:
            with self.assertRaises(StudioError): self.site.preview_skills(invalid, snap['hash'])
        with self.assertRaises(ConflictError): self.site.preview_skills(value, 'stale')
        with self.assertRaises(ConflictError): self.site.preview_skills(value, None)

    def test_modern_navigation_noop_and_metadata_preservation(self):
        items = [{'title':'Research','section':'research','custom':'keep'}, {'divider':True}, {'title':'Contact','section':'contact','style':'button'}]
        path = self.root / '_data/navigation.yml'
        import yaml
        path.write_text('# Header\n' + yaml.safe_dump({'main':items, 'extra':{'x':1}},sort_keys=False), encoding='utf-8')
        doc = self.site.navigation()
        self.assertFalse(self.site.preview_navigation(items, doc['hash'])['changed'])
        updated = copy.deepcopy(items); updated[0]['title'] = 'Work'
        preview = self.site.preview_navigation(updated, doc['hash'])
        after = base64.b64decode(preview['payload']).decode()
        self.assertEqual(after.splitlines()[0], '# Header')
        self.assertEqual(yaml.safe_load(after), {'main':updated, 'extra':{'x':1}})
        saved = self.site.apply_preview(preview, 'Menu')
        self.site.revert(saved['change']['id'])
        self.assertEqual(self.site.navigation(), doc)
