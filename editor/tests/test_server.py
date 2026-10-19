import os
import json
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from portfolio_studio.core import PortfolioSite
from server import StudioHandler, StudioServer


class StudioServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(os.environ.get("STUDIO_TEST_SITE", str(Path(__file__).resolve().parents[2])))
        if not (cls.root / "_config.yml").exists():
            raise unittest.SkipTest("The adjacent portfolio fixture is unavailable.")
        cls.http = StudioServer(("127.0.0.1", 0), StudioHandler)
        cls.http.studio = PortfolioSite(cls.root, Path(__file__).parent / ".tmp" / "server-data")
        cls.http.token = "test-token"
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.http.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join(timeout=2)

    def request(self, path, authorized=True):
        headers = {"X-Studio-Token": "test-token"} if authorized else {}
        return urllib.request.urlopen(urllib.request.Request(self.base + path, headers=headers), timeout=30)

    def test_static_shell_loads(self):
        with self.request("/") as response:
            self.assertEqual(response.status, 200)
            body = response.read()
            self.assertIn(b"Portfolio Studio", body)
            self.assertIn(b'window.__PORTFOLIO_STUDIO_TOKEN__ = "test-token"', body)
            self.assertNotIn(b"__STUDIO_SESSION_TOKEN__", body)

    def test_api_rejects_missing_token(self):
        with self.assertRaises(urllib.error.HTTPError) as caught:
            self.request("/api/bootstrap", authorized=False)
        self.assertEqual(caught.exception.code, 403)

    def test_bootstrap_reads_real_portfolio(self):
        with self.request("/api/bootstrap") as response:
            payload = json.loads(response.read())
        self.assertTrue(payload["site"]["name"])
        self.assertGreater(payload["summary"]["content"], 0)
        self.assertTrue(any(group["key"] == "publications" for group in payload["groups"]))

    def test_document_endpoint_returns_hash_without_writing(self):
        path = next((self.root / "_projects").glob("*.md")).relative_to(self.root).as_posix()
        with self.request("/api/document?path=" + urllib.parse.quote(path, safe="")) as response:
            payload = json.loads(response.read())
        self.assertEqual(payload["path"], path)
        self.assertEqual(len(payload["hash"]), 64)

    def test_modern_skills_endpoint_and_capabilities(self):
        with self.request("/api/skills") as response:
            payload = json.loads(response.read())
        self.assertIsInstance(payload["value"]["groups"], list)
        self.assertEqual(len(payload["hash"]), 64)
        with self.request("/api/bootstrap") as response:
            bootstrap = json.loads(response.read())
        self.assertTrue(bootstrap["capabilities"]["modernSkills"])
        self.assertTrue(any(group["key"] == "experience" for group in bootstrap["groups"]))

    def test_preview_can_frame_read_only_site_files(self):
        with self.request("/site/_includes/portfolio-nav.html") as response:
            self.assertEqual(response.status, 200)
            self.assertIn(b"primary-nav", response.read())
            self.assertIsNone(response.headers.get("X-Frame-Options"))
            self.assertIsNone(response.headers.get("Content-Security-Policy"))

    def test_preview_site_route_rejects_hidden_repository_paths(self):
        with self.assertRaises(urllib.error.HTTPError) as caught:
            self.request("/site/.git/config")
        self.assertEqual(caught.exception.code, 400)

    def test_duplicate_listener_is_rejected(self):
        with self.assertRaises(OSError):
            StudioServer(("127.0.0.1", self.http.server_port), StudioHandler)


if __name__ == "__main__":
    unittest.main()
