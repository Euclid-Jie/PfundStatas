# Agent Notes

- This repo is a local Flask + SQLite dashboard for filing data.
- `update_data.py` syncs source data into SQLite.
- `app.py` serves the UI and JSON APIs on port 5002 by default.
- The frontend calls `/api/*`; avoid adding new generated JSON dependencies.
- `records.manager_scale` comes from `量化私募管理人列表.管理规模` during `update_data.py` sync.
- Keep `scale_50_plus=1` consistent across dashboard, records, and Excel export; it means exactly `100亿元以上` or `50-100亿元`.
- Do not reintroduce email/submodule automation.
