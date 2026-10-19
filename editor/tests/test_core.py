import tempfile
import unittest
from pathlib import Path

from portfolio_studio.core import ConflictError, PortfolioSite, StudioError, parse_document, patch_yaml_scalars, render_document


CONFIG = '''title: "Test Portfolio"
author:
  name: "Test Person"
  bio: "Before"
future: true
collections:
  projects:
    output: true
'''


class PortfolioStudioTests(unittest.TestCase):
    def setUp(self):
        temp_root = Path(__file__).parent / ".tmp"
        temp_root.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=temp_root)
        root = Path(self.temp.name) / "site"
        data = Path(self.temp.name) / "studio-data"
        root.mkdir()
        (root / "_config.yml").write_text(CONFIG, encoding="utf-8")
        (root / "_data").mkdir()
        (root / "_data" / "navigation.yml").write_text('main:\n  - title: "Home"\n    url: /\n', encoding="utf-8")
        for folder in ["_pages", "_projects", "images", "files"]:
            (root / folder).mkdir()
        (root / "_projects" / "alpha.md").write_text('---\ntitle: Alpha\npermalink: /alpha/\n---\n\nHello **world**.\n', encoding="utf-8")
        (root / "_pages" / "projects.md").write_text('---\ntitle: Projects\n---\n\nSkill cloud: Python\n', encoding="utf-8")
        self.root = root
        self.site = PortfolioSite(root, data)

    def tearDown(self):
        self.temp.cleanup()

    def test_document_round_trip(self):
        raw = render_document({"title": "Résumé", "published": True, "tags": ["AI", "ML"]}, "Body\n")
        parsed = parse_document(raw)
        self.assertEqual(parsed["frontMatter"]["title"], "Résumé")
        self.assertEqual(parsed["frontMatter"]["tags"], ["AI", "ML"])
        self.assertEqual(parsed["body"], "Body\n")

    def test_scalar_patch_preserves_comments_and_other_values(self):
        source = 'title: "Old" # keep\nauthor:\n  bio: "Before"\n  email: x@example.com\n'
        changed = patch_yaml_scalars(source, {"title": "New", "author.bio": "After"})
        self.assertIn('title: New # keep', changed)
        self.assertIn('bio: After', changed)
        self.assertIn('email: x@example.com', changed)

    def test_preview_apply_and_revert_exact_bytes(self):
        doc = self.site.document("_projects/alpha.md")
        preview = self.site.preview_document(doc["path"], {**doc["frontMatter"], "title": "Beta"}, doc["body"], doc["hash"])
        result = self.site.apply_preview(preview, "Renamed project")
        self.assertEqual(self.site.document(doc["path"])["frontMatter"]["title"], "Beta")
        self.site.revert(result["change"]["id"])
        self.assertEqual((self.root / doc["path"]).read_text(encoding="utf-8"), '---\ntitle: Alpha\npermalink: /alpha/\n---\n\nHello **world**.\n')

    def test_grouped_preview_apply_and_revert_restores_every_file(self):
        project = self.site.document("_projects/alpha.md")
        cloud = self.site.document("_pages/projects.md")
        preview = self.site.preview_documents([
            {"path": project["path"], "frontMatter": project["frontMatter"], "body": "Project with Python.\n", "originalHash": project["hash"]},
            {"path": cloud["path"], "frontMatter": cloud["frontMatter"], "body": "Skill cloud: Python, Rust\n", "originalHash": cloud["hash"]},
        ])
        self.assertTrue(preview["changed"])
        self.assertIn("_projects/alpha.md", preview["diff"])
        self.assertIn("_pages/projects.md", preview["diff"])
        result = self.site.apply_preview(preview, "Updated project skills")
        self.assertIn("Rust", self.site.document("_pages/projects.md")["body"])
        self.site.revert(result["change"]["id"])
        self.assertEqual(self.site.document("_projects/alpha.md")["body"].replace("\r\n", "\n"), "Hello **world**.\n")
        self.assertEqual(self.site.document("_pages/projects.md")["body"].replace("\r\n", "\n"), "Skill cloud: Python\n")

    def test_grouped_save_conflict_writes_nothing(self):
        project = self.site.document("_projects/alpha.md")
        cloud = self.site.document("_pages/projects.md")
        preview = self.site.preview_documents([
            {"path": project["path"], "frontMatter": project["frontMatter"], "body": "Proposed project.\n", "originalHash": project["hash"]},
            {"path": cloud["path"], "frontMatter": cloud["frontMatter"], "body": "Proposed cloud.\n", "originalHash": cloud["hash"]},
        ])
        (self.root / cloud["path"]).write_text("changed elsewhere", encoding="utf-8")
        with self.assertRaises(ConflictError):
            self.site.apply_preview(preview, "Conflicting group")
        self.assertEqual((self.root / project["path"]).read_text(encoding="utf-8"), '---\ntitle: Alpha\npermalink: /alpha/\n---\n\nHello **world**.\n')

    def test_stale_save_is_rejected(self):
        doc = self.site.document("_projects/alpha.md")
        (self.root / doc["path"]).write_text("changed elsewhere", encoding="utf-8")
        with self.assertRaises(ConflictError):
            self.site.preview_document(doc["path"], doc["frontMatter"], doc["body"], doc["hash"])

    def test_unchanged_document_produces_no_diff(self):
        doc = self.site.document("_projects/alpha.md")
        preview = self.site.preview_document(doc["path"], doc["frontMatter"], doc["body"], doc["hash"])
        self.assertFalse(preview["changed"])
        self.assertEqual(preview["diff"], "")

    def test_edit_preserves_untouched_front_matter_style(self):
        path = self.root / "_projects" / "alpha.md"
        path.write_text('---\ntitle: "Alpha"\npermalink: /alpha/ # keep me\n---\n\nHello.\n', encoding="utf-8")
        doc = self.site.document("_projects/alpha.md")
        preview = self.site.preview_document(doc["path"], {**doc["frontMatter"], "title": "Beta"}, doc["body"], doc["hash"])
        rendered = __import__('base64').b64decode(preview["payload"]).decode("utf-8")
        self.assertIn("permalink: /alpha/ # keep me", rendered)
        self.assertIn("title: Beta", rendered)

    def test_write_allowlist_blocks_templates(self):
        with self.assertRaises(StudioError):
            self.site.resolve("_includes/head.html", writable=True)
        with self.assertRaises(StudioError):
            self.site.resolve("../outside.txt", writable=True)

    def test_create_and_restore_removes_created_file(self):
        preview = self.site.preview_create("projects", "new project", {"title": "New project"}, "Text")
        result = self.site.apply_preview(preview, "Created New project")
        created = self.root / "_projects" / "new-project.md"
        self.assertTrue(created.exists())
        self.site.revert(result["change"]["id"])
        self.assertFalse(created.exists())

    def test_duplicate_permalink_diagnostic(self):
        (self.root / "_pages" / "same.md").write_text('---\ntitle: Same\npermalink: /alpha/\n---\n', encoding="utf-8")
        issues = self.site.diagnostics()
        self.assertTrue(any(issue["title"].startswith("Duplicate address") for issue in issues))

    def test_assets_are_inventoried(self):
        (self.root / "images" / "photo.png").write_bytes(b"png")
        assets = self.site.assets()
        self.assertEqual(assets[0]["path"], "images/photo.png")

    def test_unchanged_settings_and_navigation_produce_no_diff(self):
        config = self.site.config()
        settings_preview = self.site.preview_settings({"author.bio": "Before"}, config["hash"])
        self.assertFalse(settings_preview["changed"])
        navigation = self.site.navigation()
        navigation_preview = self.site.preview_navigation(navigation["value"]["main"], navigation["hash"])
        self.assertFalse(navigation_preview["changed"])


if __name__ == "__main__":
    unittest.main()
