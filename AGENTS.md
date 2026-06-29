# Agent Notes

- This repo is a local Flask + SQLite dashboard for filing data.
- `update_data.py` syncs source data into SQLite.
- `app.py` serves the UI and JSON APIs on port 5002 by default.
- The frontend calls `/api/*`; avoid adding new generated JSON dependencies.
- Do not reintroduce email/submodule automation.
