# PfundStatas

Local Flask + SQLite dashboard for private-fund filing data.

## Run

```powershell
& .venv\Scripts\python.exe -m pip install -r requirements.txt
& .venv\Scripts\python.exe update_data.py
& .venv\Scripts\python.exe app.py
```

Development server: <http://127.0.0.1:5002>

## Data

`update_data.py` syncs records into local SQLite.

- Default path: `pfund.sqlite3`
- `update_data.py` only reads `SQL_PASSWORDS` and `SQL_HOST` from environment variables
- Other connection values are hardcoded in the script
- `registerNo` in private-fund filing data maps to `登记编号` in `量化私募管理人列表`
- Manager monthly aggregation uses `管理人简称`
- The manager monthly pivot shows monthly totals from 2024 onward, with YTD and rolling 12-month totals, and supports Excel export
- Weekly chart uses Friday as the week label
- If external database credentials are absent, it keeps the existing SQLite file

## Environment

- `DATABASE_URL`
- `SQL_USER`
- `SQL_PASSWORDS` or `SQL_PASSWORD`
- `SQL_HOST`
- `SQLITE_PATH`
- `WEB_PORT`
