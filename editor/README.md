# Portfolio Studio

A local browser-based editor included with the portfolio template. It edits the website in the parent folder by default and does not publish changes to GitHub.

## Start on Windows

Install Python 3.10 or newer, then double-click `portfolio-studio.cmd`, or run:

```powershell
./start-portfolio-studio.ps1
```

The launcher installs PyYAML in the ignored `.deps` folder on first use (internet required). Set `PORTFOLIO_STUDIO_PYTHON` to select an interpreter explicitly. Use `-Site C:\path\to\website` to edit another compatible site.

## Start on macOS or Linux

From the `editor` folder:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
python server.py
```

The editor opens in your browser and listens only on `127.0.0.1`. Use `--no-browser` to open it manually or `--port 4318` to choose another port. Stop it with Ctrl+C in the terminal.

## Editing

Manage pages, collections, experience, posts, drafts, identity settings, navigation, skills, images, downloads, and selected homepage/shared content. Shared templates expose HTML/Liquid source; keep template tags intact. Project tags and the global skills cloud are independent.

Review the exact difference before saving. Studio rejects stale edits, writes atomically, and records previous bytes for restoration. Backups and session data are stored outside the repository, in the system user-data directory under `portfolio-studio`, separately for each site. The editor requires a random session token for data requests.

The preview is a lightweight Markdown/HTML view; use Jekyll for the final Liquid rendering and website design. Studio does not automatically commit, push, or deploy. The entire `editor/` folder is excluded from the generated public website.

## Tests

With dependencies installed, run from this folder:

```sh
python -m unittest discover -s tests -v
```

Save and restore tests use temporary fixtures. Server checks read the parent template; set `STUDIO_TEST_SITE` to use another compatible fixture. Test scratch files are ignored.
