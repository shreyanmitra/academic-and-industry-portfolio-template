from __future__ import annotations

import argparse
import hashlib
import os
import json
import mimetypes
import secrets
import socket
import sys
import traceback
import urllib.parse
import urllib.request
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from portfolio_studio.core import ConflictError, PortfolioSite, StudioError


APP_ROOT = Path(__file__).resolve().parent
STATIC_ROOT = APP_ROOT / "static"


class StudioServer(ThreadingHTTPServer):
    """One exclusive listener that can serve several browser connections."""

    allow_reuse_address = False
    daemon_threads = True

    def server_bind(self) -> None:
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class StudioHandler(BaseHTTPRequestHandler):
    server_version = "PortfolioStudio/1.0"

    @property
    def studio(self) -> PortfolioSite:
        return self.server.studio  # type: ignore[attr-defined]

    @property
    def token(self) -> str:
        return self.server.token  # type: ignore[attr-defined]

    def log_message(self, format: str, *args: object) -> None:
        if self.path.startswith("/api/") and args and str(args[1]).startswith("2"):
            return
        super().log_message(format, *args)

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(15)

    def _json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length > 30 * 1024 * 1024:
            raise StudioError("Request is too large.")
        raw = self.rfile.read(length)
        try:
            value = json.loads(raw or b"{}")
        except json.JSONDecodeError as exc:
            raise StudioError("Invalid request.") from exc
        if not isinstance(value, dict):
            raise StudioError("Request must be an object.")
        return value

    def _authorized(self) -> bool:
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        supplied = self.headers.get("X-Studio-Token") or (query.get("token") or [None])[0]
        return secrets.compare_digest(str(supplied or ""), self.token)

    def _require_api_auth(self) -> bool:
        if self._authorized():
            return True
        self._json({"error": "This Studio session is no longer valid. Restart Portfolio Studio."}, HTTPStatus.FORBIDDEN)
        return False

    def do_GET(self) -> None:
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path.startswith("/api/") and not self._require_api_auth():
            return
        try:
            if parsed.path == "/api/bootstrap":
                return self._json(self.studio.bootstrap())
            if parsed.path == "/api/ping":
                return self._json({"ok": True, "site": str(self.studio.root)})
            if parsed.path == "/api/document":
                query = urllib.parse.parse_qs(parsed.query)
                return self._json(self.studio.document((query.get("path") or [""])[0]))
            if parsed.path == "/api/skills":
                return self._json(self.studio.skills())
            if parsed.path == "/api/config":
                return self._json(self.studio.config())
            if parsed.path == "/api/navigation":
                return self._json(self.studio.navigation())
            if parsed.path == "/api/history":
                return self._json({"history": self.studio.history()})
            if parsed.path == "/asset":
                if not self._authorized():
                    return self._json({"error": "Not authorized."}, HTTPStatus.FORBIDDEN)
                query = urllib.parse.parse_qs(parsed.query)
                relative = (query.get("path") or [""])[0]
                path = self.studio.resolve(relative)
                if Path(relative).parts[0] not in {"images", "files"} or not path.is_file():
                    raise StudioError("Asset not found.")
                data = path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return self.wfile.write(data)
            if parsed.path.startswith("/site/"):
                return self._site_file(parsed.path)
            return self._static(parsed.path)
        except ConflictError as exc:
            self._json({"error": str(exc), "kind": "conflict"}, HTTPStatus.CONFLICT)
        except (StudioError, OSError) as exc:
            self._json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            traceback.print_exc()
            self._json({"error": f"Unexpected local server error: {exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_POST(self) -> None:
        if not self._require_api_auth():
            return
        parsed = urllib.parse.urlsplit(self.path)
        try:
            data = self._body()
            if parsed.path == "/api/preview/document":
                return self._json(self.studio.preview_document(data["path"], data.get("frontMatter", {}), data.get("body", ""), data.get("originalHash")))
            if parsed.path == "/api/preview/documents":
                return self._json(self.studio.preview_documents(data.get("documents", [])))
            if parsed.path == "/api/preview/skills":
                return self._json(self.studio.preview_skills(data.get("value"), data.get("originalHash")))
            if parsed.path == "/api/preview/settings":
                return self._json(self.studio.preview_settings(data.get("updates", {}), data.get("originalHash")))
            if parsed.path == "/api/preview/navigation":
                return self._json(self.studio.preview_navigation(data.get("items", []), data.get("originalHash")))
            if parsed.path == "/api/preview/create":
                return self._json(self.studio.preview_create(data["group"], data["filename"], data.get("frontMatter", {}), data.get("body", "")))
            if parsed.path == "/api/apply":
                return self._json(self.studio.apply_preview(data["preview"], data.get("label", "")))
            if parsed.path == "/api/preview/delete":
                return self._json(self.studio.preview_delete(data["path"], data.get("originalHash")))
            if parsed.path == "/api/apply/delete":
                return self._json(self.studio.apply_delete(data["preview"], data.get("label", "")))
            if parsed.path == "/api/assets/upload":
                return self._json(self.studio.upload_asset(data["folder"], data["filename"], data["content"]))
            if parsed.path == "/api/revert":
                return self._json(self.studio.revert(data["changeId"]))
            return self._json({"error": "Unknown action."}, HTTPStatus.NOT_FOUND)
        except ConflictError as exc:
            self._json({"error": str(exc), "kind": "conflict"}, HTTPStatus.CONFLICT)
        except (KeyError, StudioError, OSError) as exc:
            self._json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            traceback.print_exc()
            self._json({"error": f"Unexpected local server error: {exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _static(self, request_path: str) -> None:
        relative = "index.html" if request_path in {"", "/"} else request_path.lstrip("/")
        path = (STATIC_ROOT / relative).resolve()
        try:
            path.relative_to(STATIC_ROOT.resolve())
        except ValueError:
            return self.send_error(404)
        if not path.is_file():
            path = STATIC_ROOT / "index.html"
        data = path.read_bytes()
        if path.name == "index.html":
            data = data.replace(
                b"__STUDIO_SESSION_TOKEN__",
                json.dumps(self.server.token).encode("utf-8"),
            )
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def _site_file(self, request_path: str) -> None:
        relative = urllib.parse.unquote(request_path.removeprefix("/site/"))
        path = self.studio.resolve(relative)
        if not path.is_file():
            return self.send_error(404)
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)


def default_site() -> Path:
    return APP_ROOT.parent


def reuse_running_session(data_dir: Path, no_browser: bool, site_root: Path | None = None) -> bool:
    session_path = data_dir / "session.json"
    if not session_path.is_file():
        return False
    try:
        session = json.loads(session_path.read_text(encoding="utf-8"))
        token = str(session["token"])
        port = int(session["port"])
        request = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/ping",
            headers={"X-Studio-Token": token},
        )
        with urllib.request.urlopen(request, timeout=2) as response:
            if response.status != 200:
                return False
            payload = json.load(response)
            if site_root is not None and payload.get("site") != str(site_root.resolve()):
                return False
        url = f"http://127.0.0.1:{port}/?token={urllib.parse.quote(token)}"
        print(f"Portfolio Studio is already running at {url}")
        if not no_browser:
            webbrowser.open(url)
        return True
    except (KeyError, ValueError, OSError, json.JSONDecodeError):
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="A safe local editor for a Jekyll portfolio.")
    parser.add_argument("--site", type=Path, default=default_site(), help="Path to the Jekyll website")
    parser.add_argument("--port", type=int, default=4317)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    try:
        data_home = Path(os.environ.get("LOCALAPPDATA") or os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
        site_key = hashlib.sha256(str(args.site.resolve()).encode()).hexdigest()[:16]
        studio = PortfolioSite(args.site, data_home / "portfolio-studio" / site_key)
    except StudioError as exc:
        print(f"Portfolio Studio could not start: {exc}", file=sys.stderr)
        return 2
    if reuse_running_session(studio.data_dir, args.no_browser, studio.root):
        return 0
    token = secrets.token_urlsafe(24)
    try:
        server = StudioServer(("127.0.0.1", args.port), StudioHandler)
    except OSError as exc:
        print(f"Portfolio Studio could not start because local port {args.port} is in use. Close the older Studio window and try again. ({exc})", file=sys.stderr)
        return 3
    server.studio = studio  # type: ignore[attr-defined]
    server.token = token  # type: ignore[attr-defined]
    url = f"http://127.0.0.1:{server.server_port}/?token={urllib.parse.quote(token)}"
    session_path = studio.data_dir / "session.json"
    session_path.write_text(json.dumps({"port": server.server_port, "token": token}), encoding="utf-8")
    print(f"Portfolio Studio is ready at {url}")
    print(f"Editing: {studio.root}")
    print("Press Ctrl+C to stop.")
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        try:
            active = json.loads(session_path.read_text(encoding="utf-8"))
            if active.get("token") == token:
                session_path.unlink()
        except (OSError, json.JSONDecodeError):
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
