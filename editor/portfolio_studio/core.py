from __future__ import annotations

import base64
import datetime as dt
import difflib
import hashlib
import json
import os
import re
import tempfile
import uuid
from pathlib import Path
from typing import Any

import yaml


CONTENT_GROUPS = {
    "pages": ("_pages", "Pages"),
    "projects": ("_projects", "Projects"),
    "experience": ("_experience", "Experience"),
    "publications": ("_publications", "Publications"),
    "talks": ("_talks", "Talks"),
    "teaching": ("_teaching", "Teaching"),
    "leadership": ("_leadership", "Leadership"),
    "portfolio": ("_portfolio", "Portfolio"),
    "posts": ("_posts", "Posts"),
    "drafts": ("_drafts", "Drafts"),
}
ASSET_DIRS = {"images", "files"}
SITE_COPY = {
    "_data/portfolio.yml": "Homepage configuration",
    "_layouts/portfolio-home.html": "Homepage, hero & portraits",
    "_layouts/portfolio.html": "Site footer & shell",
    "_includes/portfolio-biography.html": "Full biography",
    "_includes/portfolio-awards.html": "Awards",
    "_includes/portfolio-research.html": "Research introduction",
    "_includes/portfolio-project-notes.html": "Project notes",
    "_includes/portfolio-publication-notes.html": "Publication notes",
    "_includes/portfolio-talk-notes.html": "Talk notes",
    "_includes/portfolio-nav.html": "Navigation wordmark",
    "_data/portfolio_ui.yml": "Publication date",
}
SKILLS_PATH = "_data/portfolio_skills.json"
EDITABLE_SINGLE_FILES = {"_config.yml", "_data/navigation.yml", SKILLS_PATH} | set(SITE_COPY)


class StudioError(Exception):
    pass


class ConflictError(StudioError):
    pass


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_safe(value: Any) -> Any:
    if isinstance(value, (dt.date, dt.datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(v) for v in value]
    return value


def load_yaml(text: str) -> Any:
    try:
        return yaml.safe_load(text) if text.strip() else {}
    except yaml.YAMLError as exc:
        raise StudioError(f"Invalid YAML: {exc}") from exc


def parse_document(data: bytes) -> dict[str, Any]:
    text = data.decode("utf-8-sig")
    newline = "\r\n" if "\r\n" in text else "\n"
    match = re.match(r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n(?:\r?\n)?|\Z)(.*)\Z", text, re.S)
    if not match:
        return {"frontMatter": {}, "body": text, "hasFrontMatter": False, "newline": newline}
    parsed = load_yaml(match.group(1))
    if parsed is None:
        parsed = {}
    if not isinstance(parsed, dict):
        raise StudioError("Front matter must be a key/value mapping.")
    return {
        "frontMatter": json_safe(parsed),
        "body": match.group(2),
        "hasFrontMatter": True,
        "newline": newline,
    }


def render_document(front_matter: dict[str, Any], body: str, newline: str = "\n") -> bytes:
    if not isinstance(front_matter, dict):
        raise StudioError("Front matter must be an object.")
    normalized = {k: v for k, v in front_matter.items() if v not in (None, "")}
    dumped = yaml.safe_dump(
        normalized,
        allow_unicode=True,
        default_flow_style=False,
        sort_keys=False,
        width=1000,
    ).rstrip()
    text = f"---\n{dumped}\n---\n\n{body.lstrip()}"
    if newline == "\r\n":
        text = text.replace("\n", "\r\n")
    return text.encode("utf-8")


def render_document_preserving(current: bytes, front_matter: dict[str, Any], body: str) -> bytes:
    """Update top-level front matter while leaving untouched YAML exactly as written."""
    text = current.decode("utf-8-sig")
    newline = "\r\n" if "\r\n" in text else "\n"
    match = re.match(r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n(?:\r?\n)?|\Z)(.*)\Z", text, re.S)
    if not match:
        return render_document(front_matter, body, newline)
    old_front_text, old_body = match.group(1), match.group(2)
    old_front = json_safe(load_yaml(old_front_text) or {})
    if old_front == front_matter and old_body == body:
        return current

    lines = old_front_text.splitlines(keepends=True)
    key_re = re.compile(r"^(?P<key>[A-Za-z0-9_.-]+)\s*:")
    starts: list[tuple[int, str]] = []
    for index, line in enumerate(lines):
        key_match = key_re.match(line)
        if key_match:
            starts.append((index, key_match.group("key")))
    blocks: dict[str, str] = {}
    order: list[str] = []
    prefix = "".join(lines[: starts[0][0]]) if starts else old_front_text
    for position, (start, key) in enumerate(starts):
        end = starts[position + 1][0] if position + 1 < len(starts) else len(lines)
        blocks[key] = "".join(lines[start:end])
        order.append(key)

    output = [prefix]
    for key in order:
        if key not in front_matter:
            continue
        if key in old_front and old_front[key] == front_matter[key]:
            output.append(blocks[key])
        else:
            rendered = yaml.safe_dump(
                {key: front_matter[key]}, allow_unicode=True, default_flow_style=False,
                sort_keys=False, width=1000,
            )
            output.append(rendered.replace("\n", newline))
    for key, value in front_matter.items():
        if key not in blocks:
            rendered = yaml.safe_dump(
                {key: value}, allow_unicode=True, default_flow_style=False,
                sort_keys=False, width=1000,
            )
            output.append(rendered.replace("\n", newline))
    new_front = "".join(output).rstrip("\r\n")
    return f"---{newline}{new_front}{newline}---{newline}{newline}{body}".encode("utf-8")


def scalar_yaml(value: Any) -> str:
    if value is None or value == "":
        return ""
    return yaml.safe_dump(value, allow_unicode=True, default_flow_style=True, width=1000).strip().removesuffix("...").strip()


def patch_yaml_scalars(text: str, updates: dict[str, Any]) -> str:
    lines = text.splitlines(keepends=True)
    stack: list[tuple[int, str]] = []
    found: set[str] = set()
    key_re = re.compile(r"^(?P<indent>\s*)(?P<key>[^#\s][^:]*?):(?P<rest>.*?)(?P<eol>\r?\n)?$")
    for index, line in enumerate(lines):
        match = key_re.match(line)
        if not match:
            continue
        indent = len(match.group("indent").replace("\t", "  "))
        key = match.group("key").strip().strip("'\"")
        while stack and stack[-1][0] >= indent:
            stack.pop()
        path = ".".join([part for _, part in stack] + [key])
        rest = match.group("rest")
        stripped = rest.strip()
        is_mapping = not stripped or stripped.startswith("#")
        if path in updates:
            comment = ""
            comment_match = re.search(r"\s+#", rest)
            if comment_match:
                comment = rest[comment_match.start():]
            eol = match.group("eol") or ""
            value = scalar_yaml(updates[path])
            spacer = " " if value else ""
            lines[index] = f"{match.group('indent')}{match.group('key')}:{spacer}{value}{comment}{eol}"
            found.add(path)
            is_mapping = False
        if is_mapping:
            stack.append((indent, key))
    missing = sorted(set(updates) - found)
    if missing:
        raise StudioError("Unknown setting path: " + ", ".join(missing))
    return "".join(lines)


def deep_get(mapping: dict[str, Any], dotted_path: str) -> Any:
    value: Any = mapping
    for key in dotted_path.split("."):
        if not isinstance(value, dict) or key not in value:
            return object()
        value = value[key]
    return value


def unified_diff(path: str, before: bytes | None, after: bytes | None) -> str:
    before_text = "" if before is None else before.decode("utf-8", errors="replace")
    after_text = "" if after is None else after.decode("utf-8", errors="replace")
    return "".join(
        difflib.unified_diff(
            before_text.splitlines(keepends=True),
            after_text.splitlines(keepends=True),
            fromfile=f"a/{path}",
            tofile=f"b/{path}",
        )
    )


class PortfolioSite:
    def __init__(self, root: Path, data_dir: Path):
        self.root = root.resolve()
        self.data_dir = data_dir.resolve()
        if not (self.root / "_config.yml").is_file():
            raise StudioError(f"That folder is not a supported Jekyll portfolio: {self.root}")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "backups").mkdir(exist_ok=True)
        self.history_path = self.data_dir / "history.jsonl"

    def resolve(self, relative: str, *, writable: bool = False) -> Path:
        clean = relative.replace("\\", "/").lstrip("/")
        if not clean or clean.startswith(".") or "/." in clean:
            raise StudioError("Invalid path.")
        candidate = (self.root / clean).resolve()
        try:
            candidate.relative_to(self.root)
        except ValueError as exc:
            raise StudioError("Path leaves the selected website folder.") from exc
        if writable:
            first = Path(clean).parts[0]
            allowed = first in {folder for folder, _ in CONTENT_GROUPS.values()} | ASSET_DIRS or clean in EDITABLE_SINGLE_FILES
            if not allowed:
                raise StudioError("Portfolio Studio does not write to templates, styles, scripts, or repository internals.")
        return candidate

    def read_bytes(self, relative: str) -> bytes:
        path = self.resolve(relative)
        if not path.is_file():
            raise StudioError("File not found.")
        return path.read_bytes()

    def content_groups(self) -> list[dict[str, Any]]:
        groups = []
        for key, (folder, label) in CONTENT_GROUPS.items():
            location = self.root / folder
            if location.is_dir():
                items = []
                for path in sorted((p for p in location.rglob("*") if p.is_file()), key=lambda p: p.name.lower()):
                    relative = path.relative_to(self.root).as_posix()
                    try:
                        parsed = parse_document(path.read_bytes())
                        fm = parsed["frontMatter"]
                        title = fm.get("title") or path.stem.replace("-", " ").title()
                        invalid = None
                    except Exception as exc:
                        fm, title, invalid = {}, path.name, str(exc)
                    items.append({
                        "path": relative,
                        "name": path.name,
                        "title": title,
                        "date": fm.get("date"),
                        "permalink": fm.get("permalink"),
                        "published": fm.get("published", True),
                        "invalid": invalid,
                    })
                groups.append({"key": key, "folder": folder, "label": label, "count": len(items), "items": items})
        items = [{"path": path, "name": Path(path).name, "title": title,
                  "date": None, "permalink": None, "published": True, "invalid": None}
                 for path, title in SITE_COPY.items() if (self.root / path).is_file()]
        if items:
            groups.append({"key": "sitecopy", "folder": "", "label": "Homepage & shared content",
                           "count": len(items), "items": items, "fixed": True})
        return groups

    def document(self, relative: str) -> dict[str, Any]:
        data = self.read_bytes(relative)
        parsed = parse_document(data)
        parsed.update({"path": relative.replace("\\", "/"), "hash": sha256(data), "size": len(data)})
        return parsed

    def config(self) -> dict[str, Any]:
        data = self.read_bytes("_config.yml")
        parsed = load_yaml(data.decode("utf-8-sig")) or {}
        return {"value": json_safe(parsed), "hash": sha256(data)}

    def navigation(self) -> dict[str, Any]:
        data = self.read_bytes("_data/navigation.yml")
        parsed = load_yaml(data.decode("utf-8-sig")) or {}
        return {"value": json_safe(parsed), "hash": sha256(data)}

    def assets(self) -> list[dict[str, Any]]:
        result = []
        for dirname in sorted(ASSET_DIRS):
            folder = self.root / dirname
            if not folder.is_dir():
                continue
            for path in sorted((p for p in folder.rglob("*") if p.is_file()), key=lambda p: p.name.lower()):
                stat = path.stat()
                relative = path.relative_to(self.root).as_posix()
                result.append({
                    "path": relative,
                    "name": path.name,
                    "folder": dirname,
                    "size": stat.st_size,
                    "modified": dt.datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="minutes"),
                    "kind": "image" if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"} else "file",
                })
        return result

    def diagnostics(self) -> list[dict[str, Any]]:
        issues: list[dict[str, Any]] = []
        permalink_map: dict[str, list[str]] = {}
        docs = [item for group in self.content_groups() for item in group["items"]]
        for item in docs:
            if item.get("invalid"):
                issues.append({"level": "error", "title": "Unreadable front matter", "detail": item["invalid"], "paths": [item["path"]]})
            permalink = item.get("permalink")
            if permalink:
                normalized = str(permalink).rstrip("/") or "/"
                permalink_map.setdefault(normalized, []).append(item["path"])
        for permalink, paths in permalink_map.items():
            if len(paths) > 1:
                issues.append({"level": "error", "title": f"Duplicate address: {permalink}", "detail": "More than one item publishes to the same address.", "paths": paths})

        missing: dict[str, set[str]] = {}
        known_routes = {str(item["permalink"]).rstrip("/") or "/" for item in docs if item.get("permalink")}
        reference_re = re.compile(r"(?:href|src)=[\"']([^\"']+)|!?\[[^\]]*\]\(([^)]+)")
        for item in docs:
            try:
                text = self.read_bytes(item["path"]).decode("utf-8", errors="ignore")
            except StudioError:
                continue
            source_dir = (self.root / item["path"]).parent
            for match in reference_re.finditer(text):
                ref = (match.group(1) or match.group(2) or "").strip()
                if not ref or ref.startswith(("http://", "https://", "mailto:", "#", "{{", "{%", "data:")):
                    continue
                ref = ref.strip("<>")
                if ref.startswith("/") and (ref.rstrip("/") or "/") in known_routes:
                    continue
                ref = ref.split("#", 1)[0].split("?", 1)[0]
                target = self.root / ref.lstrip("/") if ref.startswith("/") else source_dir / ref
                if not target.exists():
                    missing.setdefault(ref, set()).add(item["path"])
        for ref, paths in sorted(missing.items()):
            issues.append({"level": "warning", "title": f"Missing linked file: {ref}", "detail": "This local image or download could not be found.", "paths": sorted(paths)})
        return issues

    def bootstrap(self) -> dict[str, Any]:
        groups = self.content_groups()
        issues = self.diagnostics()
        return {
            "site": {"root": str(self.root), "name": self.config()["value"].get("title", self.root.name)},
            "groups": groups,
            "assets": self.assets(),
            "issues": issues,
            "capabilities": {"homepageData": (self.root / "_data/portfolio.yml").is_file(), "modernSkills": (self.root / SKILLS_PATH).is_file(), "templateContent": (self.root / "_layouts/portfolio-home.html").is_file()},
            "history": self.history(limit=40),
            "summary": {
                "content": sum(group["count"] for group in groups),
                "media": len(self.assets()),
                "issues": len(issues),
                "lastChange": (self.history(limit=1) or [{}])[0].get("timestamp"),
            },
        }

    def preview_document(self, relative: str, front_matter: dict[str, Any], body: str, original_hash: str | None) -> dict[str, Any]:
        current = self.read_bytes(relative)
        if original_hash and sha256(current) != original_hash:
            raise ConflictError("This file changed after you opened it. Reload it before saving.")
        self.resolve(relative, writable=True)
        parsed = parse_document(current)
        if not parsed["hasFrontMatter"] and not front_matter:
            after = current if body == parsed["body"] else body.replace("\r\n", "\n").replace("\n", parsed["newline"]).encode("utf-8")
        else:
            after = render_document_preserving(current, front_matter, body)
        return self._preview(relative, current, after)

    def preview_documents(self, documents: list[dict[str, Any]]) -> dict[str, Any]:
        if not isinstance(documents, list) or not documents or len(documents) > 10:
            raise StudioError("Choose between one and ten portfolio files to review together.")
        previews = []
        seen: set[str] = set()
        for document in documents:
            if not isinstance(document, dict):
                raise StudioError("Each reviewed portfolio file must be an object.")
            relative = str(document.get("path", "")).replace("\\", "/")
            if relative in seen:
                raise StudioError(f"A reviewed change includes {relative} more than once.")
            seen.add(relative)
            previews.append(self.preview_document(
                relative,
                document.get("frontMatter", {}),
                str(document.get("body", "")),
                document.get("originalHash"),
            ))
        return {
            "batch": previews,
            "path": f"{previews[0]['path']} + {len(previews) - 1} more" if len(previews) > 1 else previews[0]["path"],
            "changed": any(preview["changed"] for preview in previews),
            "diff": "\n".join(preview["diff"] for preview in previews if preview["diff"]),
        }

    def preview_settings(self, updates: dict[str, Any], original_hash: str | None) -> dict[str, Any]:
        relative = "_config.yml"
        current = self.read_bytes(relative)
        if original_hash and sha256(current) != original_hash:
            raise ConflictError("Settings changed after you opened them. Reload before saving.")
        current_text = current.decode("utf-8-sig")
        current_value = json_safe(load_yaml(current_text) or {})
        changed_updates = {path: value for path, value in updates.items() if deep_get(current_value, path) != value}
        after = patch_yaml_scalars(current_text, changed_updates).encode("utf-8") if changed_updates else current
        load_yaml(after.decode("utf-8"))
        return self._preview(relative, current, after)

    def preview_navigation(self, items: list[dict[str, Any]], original_hash: str | None) -> dict[str, Any]:
        relative = "_data/navigation.yml"
        current = self.read_bytes(relative)
        if original_hash and sha256(current) != original_hash:
            raise ConflictError("Navigation changed after you opened it. Reload before saving.")
        if not isinstance(items, list) or any(not isinstance(item, dict) for item in items):
            raise StudioError("Navigation must be a list of entries.")
        cleaned = []
        for item in items:
            entry = dict(item)
            for key in ("title", "url", "section", "style"):
                if key in entry:
                    entry[key] = str(entry[key]).strip()
                    if not entry[key]:
                        entry.pop(key)
            if entry.get("divider") is not True and (not entry.get("title") or not (entry.get("url") or entry.get("section"))):
                raise StudioError("Each link needs a label and either an address or homepage section.")
            cleaned.append(entry)
        current_value = json_safe(load_yaml(current.decode("utf-8-sig")) or {})
        if current_value.get("main", []) == cleaned:
            after = current
        else:
            current_value["main"] = cleaned
            # Preserve the explanatory header and every other navigation setting.
            header = re.match(r"(?:[ \t]*(?:#[^\n]*)?\r?\n)*", current.decode("utf-8-sig")).group(0)
            after = (header + yaml.safe_dump(current_value, allow_unicode=True, sort_keys=False)).encode("utf-8")
        return self._preview(relative, current, after)

    def skills(self) -> dict[str, Any]:
        raw = self.read_bytes(SKILLS_PATH)
        try:
            value = json.loads(raw)
        except (ValueError, UnicodeError) as exc:
            raise StudioError("The skills data is not valid JSON.") from exc
        self.validate_skills(value)
        return {"value": value, "hash": sha256(raw)}

    @staticmethod
    def validate_skills(value: Any) -> None:
        if not isinstance(value, dict) or not isinstance(value.get("groups"), list):
            raise StudioError("Skills need a groups list.")
        for group in value["groups"]:
            if not isinstance(group, dict) or not isinstance(group.get("name"), str) or not group["name"].strip():
                raise StudioError("Every skill group needs a name.")
            if not isinstance(group.get("skills"), list) or any(not isinstance(x, str) or not x.strip() for x in group["skills"]):
                raise StudioError("Every skill must be nonempty text.")
        for key in ("languages", "degrees"):
            if key in value and (not isinstance(value[key], list) or any(not isinstance(x, str) or not x.strip() for x in value[key])):
                raise StudioError(f"{key.title()} must be a list of nonempty text.")

    def preview_skills(self, value: dict[str, Any], original_hash: str | None) -> dict[str, Any]:
        current = self.read_bytes(SKILLS_PATH)
        if not original_hash or sha256(current) != original_hash:
            raise ConflictError("Skills changed after you opened them. Reload before saving.")
        self.validate_skills(value)
        after = current if json.loads(current) == value else (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        return self._preview(SKILLS_PATH, current, after)

    def preview_create(self, group: str, filename: str, front_matter: dict[str, Any], body: str) -> dict[str, Any]:
        if group not in CONTENT_GROUPS:
            raise StudioError("Unknown content group.")
        folder = CONTENT_GROUPS[group][0]
        safe_name = re.sub(r"[^a-zA-Z0-9._-]+", "-", filename.strip()).strip("-.")
        if not safe_name:
            raise StudioError("Choose a filename.")
        if not Path(safe_name).suffix:
            safe_name += ".md"
        relative = f"{folder}/{safe_name}"
        path = self.resolve(relative, writable=True)
        if path.exists():
            raise StudioError("A file with that name already exists.")
        return self._preview(relative, None, render_document(front_matter, body))

    def _preview(self, relative: str, before: bytes | None, after: bytes | None) -> dict[str, Any]:
        return {
            "path": relative,
            "beforeHash": sha256(before) if before is not None else None,
            "afterHash": sha256(after) if after is not None else None,
            "changed": before != after,
            "diff": unified_diff(relative, before, after),
            "payload": base64.b64encode(after or b"").decode("ascii"),
        }

    def apply_preview(self, preview: dict[str, Any], label: str) -> dict[str, Any]:
        if isinstance(preview.get("batch"), list):
            return self.apply_previews(preview["batch"], label)
        relative = str(preview.get("path", ""))
        path = self.resolve(relative, writable=True)
        before = path.read_bytes() if path.exists() else None
        expected = preview.get("beforeHash")
        if (sha256(before) if before is not None else None) != expected:
            raise ConflictError("The file changed after review. Nothing was saved.")
        try:
            after = base64.b64decode(preview.get("payload", ""), validate=True)
        except Exception as exc:
            raise StudioError("Invalid reviewed change.") from exc
        if sha256(after) != preview.get("afterHash"):
            raise StudioError("The reviewed change did not pass its integrity check.")
        if before == after:
            return {"changed": False, "path": relative}
        self._atomic_write(path, after)
        record = self._record(relative, before, after, label, "save")
        return {"changed": True, "path": relative, "hash": sha256(after), "change": record}

    def apply_previews(self, previews: list[dict[str, Any]], label: str) -> dict[str, Any]:
        if not previews or len(previews) > 10:
            raise StudioError("Invalid grouped review.")
        planned: list[tuple[str, Path, bytes | None, bytes]] = []
        seen: set[str] = set()
        for preview in previews:
            relative = str(preview.get("path", ""))
            if relative in seen:
                raise StudioError(f"A reviewed change includes {relative} more than once.")
            seen.add(relative)
            path = self.resolve(relative, writable=True)
            before = path.read_bytes() if path.exists() else None
            if (sha256(before) if before is not None else None) != preview.get("beforeHash"):
                raise ConflictError("A file changed after review. Nothing was saved.")
            try:
                after = base64.b64decode(preview.get("payload", ""), validate=True)
            except Exception as exc:
                raise StudioError("Invalid reviewed change.") from exc
            if sha256(after) != preview.get("afterHash"):
                raise StudioError("A reviewed change did not pass its integrity check.")
            if before != after:
                planned.append((relative, path, before, after))
        if not planned:
            return {"changed": False, "path": str(previews[0].get("path", ""))}

        written: list[tuple[Path, bytes | None]] = []
        try:
            for _, path, before, after in planned:
                self._atomic_write(path, after)
                written.append((path, before))
        except Exception:
            for path, before in reversed(written):
                if before is None:
                    if path.exists():
                        path.unlink()
                else:
                    self._atomic_write(path, before)
            raise
        record = self._record_batch(
            [(relative, before, after) for relative, _, before, after in planned],
            label,
            "save",
        )
        return {"changed": True, "path": record["path"], "change": record}

    def preview_delete(self, relative: str, original_hash: str | None) -> dict[str, Any]:
        current = self.read_bytes(relative)
        self.resolve(relative, writable=True)
        if relative.replace("\\", "/") in EDITABLE_SINGLE_FILES:
            raise StudioError("Shared site files cannot be removed in Studio.")
        if original_hash and sha256(current) != original_hash:
            raise ConflictError("The file changed after you opened it. Reload before removing it.")
        result = self._preview(relative, current, None)
        result["delete"] = True
        return result

    def apply_delete(self, preview: dict[str, Any], label: str) -> dict[str, Any]:
        relative = str(preview.get("path", ""))
        if relative.replace("\\", "/") in EDITABLE_SINGLE_FILES:
            raise StudioError("Shared site files cannot be removed in Studio.")
        path = self.resolve(relative, writable=True)
        if not path.is_file():
            raise ConflictError("The file no longer exists.")
        before = path.read_bytes()
        if sha256(before) != preview.get("beforeHash"):
            raise ConflictError("The file changed after review. Nothing was removed.")
        path.unlink()
        record = self._record(relative, before, None, label, "delete")
        return {"changed": True, "path": relative, "change": record}

    def upload_asset(self, folder: str, filename: str, content_b64: str) -> dict[str, Any]:
        if folder not in ASSET_DIRS:
            raise StudioError("Assets can only be added to images or files.")
        safe_name = Path(filename).name
        if not safe_name or safe_name != filename or safe_name.startswith("."):
            raise StudioError("Invalid filename.")
        relative = f"{folder}/{safe_name}"
        path = self.resolve(relative, writable=True)
        if path.exists():
            raise ConflictError("An asset with that name already exists.")
        try:
            after = base64.b64decode(content_b64, validate=True)
        except Exception as exc:
            raise StudioError("Invalid upload.") from exc
        if len(after) > 25 * 1024 * 1024:
            raise StudioError("Files larger than 25 MB are not accepted.")
        self._atomic_write(path, after)
        record = self._record(relative, None, after, f"Added {safe_name}", "upload")
        return {"path": relative, "hash": sha256(after), "change": record}

    def _atomic_write(self, path: Path, content: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
        try:
            with os.fdopen(handle, "wb") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def _record(self, relative: str, before: bytes | None, after: bytes | None, label: str, action: str) -> dict[str, Any]:
        change_id = f"{dt.datetime.now().strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:8]}"
        backup = self.data_dir / "backups" / f"{change_id}.json"
        backup.write_text(json.dumps({
            "before": base64.b64encode(before).decode("ascii") if before is not None else None,
            "after": base64.b64encode(after).decode("ascii") if after is not None else None,
        }), encoding="utf-8")
        record = {
            "id": change_id,
            "timestamp": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
            "path": relative,
            "label": label or f"Updated {Path(relative).name}",
            "action": action,
            "beforeHash": sha256(before) if before is not None else None,
            "afterHash": sha256(after) if after is not None else None,
            "backup": backup.name,
            "revertedBy": None,
        }
        with self.history_path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
        return record

    def _record_batch(self, files: list[tuple[str, bytes | None, bytes | None]], label: str, action: str) -> dict[str, Any]:
        change_id = f"{dt.datetime.now().strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:8]}"
        backup = self.data_dir / "backups" / f"{change_id}.json"
        backup.write_text(json.dumps({"files": [
            {
                "path": relative,
                "before": base64.b64encode(before).decode("ascii") if before is not None else None,
                "after": base64.b64encode(after).decode("ascii") if after is not None else None,
            }
            for relative, before, after in files
        ]}), encoding="utf-8")
        display_path = files[0][0] if len(files) == 1 else f"{files[0][0]} + {len(files) - 1} more"
        record = {
            "id": change_id,
            "timestamp": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
            "path": display_path,
            "label": label or "Updated portfolio content",
            "action": action,
            "files": [
                {
                    "path": relative,
                    "beforeHash": sha256(before) if before is not None else None,
                    "afterHash": sha256(after) if after is not None else None,
                }
                for relative, before, after in files
            ],
            "backup": backup.name,
            "revertedBy": None,
        }
        with self.history_path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
        return record

    def history(self, limit: int = 100) -> list[dict[str, Any]]:
        if not self.history_path.exists():
            return []
        records = []
        for line in self.history_path.read_text(encoding="utf-8").splitlines():
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return list(reversed(records[-limit:]))

    def revert(self, change_id: str) -> dict[str, Any]:
        record = next((entry for entry in self.history(10000) if entry.get("id") == change_id), None)
        if not record:
            raise StudioError("Change not found.")
        if isinstance(record.get("files"), list):
            backup_path = self.data_dir / "backups" / record["backup"]
            payload = json.loads(backup_path.read_text(encoding="utf-8"))
            saved_files = payload.get("files", [])
            hashes = {item["path"]: item for item in record["files"]}
            planned: list[tuple[str, Path, bytes | None, bytes | None]] = []
            for item in saved_files:
                relative = str(item["path"])
                path = self.resolve(relative, writable=True)
                current = path.read_bytes() if path.exists() else None
                expected = hashes.get(relative, {}).get("afterHash")
                if (sha256(current) if current is not None else None) != expected:
                    raise ConflictError("A file in this grouped change has changed since that save, so nothing was restored.")
                before = base64.b64decode(item["before"]) if item.get("before") is not None else None
                planned.append((relative, path, current, before))
            written: list[tuple[Path, bytes | None]] = []
            try:
                for _, path, current, before in planned:
                    if before is None:
                        if path.exists():
                            path.unlink()
                    else:
                        self._atomic_write(path, before)
                    written.append((path, current))
            except Exception:
                for path, current in reversed(written):
                    if current is None:
                        if path.exists():
                            path.unlink()
                    else:
                        self._atomic_write(path, current)
                raise
            revert_record = self._record_batch(
                [(relative, current, before) for relative, _, current, before in planned],
                f"Restored before: {record['label']}",
                "revert",
            )
            return {"changed": True, "path": record["path"], "change": revert_record}
        path = self.resolve(record["path"], writable=True)
        current = path.read_bytes() if path.exists() else None
        if (sha256(current) if current is not None else None) != record.get("afterHash"):
            raise ConflictError("This file has changed since that save, so it cannot be restored automatically.")
        backup_path = self.data_dir / "backups" / record["backup"]
        payload = json.loads(backup_path.read_text(encoding="utf-8"))
        before = base64.b64decode(payload["before"]) if payload.get("before") is not None else None
        if before is None:
            if path.exists():
                path.unlink()
        else:
            self._atomic_write(path, before)
        revert_record = self._record(record["path"], current, before, f"Restored before: {record['label']}", "revert")
        return {"changed": True, "path": record["path"], "change": revert_record}
