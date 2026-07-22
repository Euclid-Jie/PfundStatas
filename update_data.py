from __future__ import annotations

import os
import sqlite3
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from config import SQL_HOST, SQL_PASSWORDS, SQLITE_PATH


ROOT = Path(__file__).resolve().parent
SQL_USER = "dev"
SQL_DATABASE = "Euclid"
SQL_PORT = 3306
RAW_TABLE = "私募基金备案信息"
MANAGER_TABLE = "量化私募管理人列表"
START_DATE = "2024-01-01"

START_TS = pd.Timestamp(START_DATE)

RECORD_COLUMNS = [
    "fundNo",
    "fundName",
    "managerName",
    "managerShortName",
    "managerType",
    "workingState",
    "putOnRecordDate",
    "mandatorName",
    "registerNo",
    "managerScale",
]


def build_engine():
    if not SQL_PASSWORDS or not SQL_HOST:
        return None
    url = (
        f"mysql+pymysql://{SQL_USER}:{SQL_PASSWORDS}"
        f"@{SQL_HOST}:{SQL_PORT}/{SQL_DATABASE}?charset=utf8mb4"
    )
    return create_engine(url)


def load_from_source() -> pd.DataFrame:
    engine = build_engine()
    if engine is None:
        return pd.DataFrame(columns=RECORD_COLUMNS)

    query = f"""
        SELECT
            r.fundNo,
            r.fundName,
            r.managerName,
            m.managerShortName,
            r.managerType,
            r.workingState,
            r.putOnRecordDate,
            r.mandatorName,
            r.registerNo,
            m.managerScale
        FROM `{RAW_TABLE}` r
        JOIN (
            SELECT
                `登记编号` AS registerNo,
                `管理人简称` AS managerShortName,
                `管理规模` AS managerScale
            FROM `{MANAGER_TABLE}`
        ) m ON r.registerNo = m.registerNo
        WHERE r.putOnRecordDate >= :start_date
        ORDER BY r.putOnRecordDate DESC, r.fundNo DESC
    """
    return pd.read_sql_query(
        text(query),
        engine,
        params={"start_date": START_TS.strftime("%Y-%m-%d")},
    )


def normalize_records(records: pd.DataFrame) -> pd.DataFrame:
    frame = records[RECORD_COLUMNS].copy()
    frame["putOnRecordDate"] = pd.to_datetime(frame["putOnRecordDate"], errors="coerce")
    frame = frame.dropna(subset=["putOnRecordDate"])
    frame = frame[frame["putOnRecordDate"] >= START_TS]
    frame["putOnRecordDate"] = frame["putOnRecordDate"].dt.strftime("%Y-%m-%d")
    return frame.fillna("")


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS records (
            fund_no TEXT PRIMARY KEY,
            fund_name TEXT NOT NULL,
            manager_name TEXT NOT NULL,
            manager_short_name TEXT,
            manager_type TEXT,
            working_state TEXT,
            put_on_record_date TEXT NOT NULL,
            mandator_name TEXT,
            register_no TEXT,
            manager_scale TEXT
        );
        """
    )
    columns = {row[1] for row in conn.execute("PRAGMA table_info(records)")}
    if "manager_scale" not in columns:
        conn.execute("ALTER TABLE records ADD COLUMN manager_scale TEXT")
    conn.executescript(
        """
        CREATE INDEX IF NOT EXISTS idx_records_date ON records(put_on_record_date);
        CREATE INDEX IF NOT EXISTS idx_records_manager_month ON records(manager_name, put_on_record_date);
        CREATE INDEX IF NOT EXISTS idx_records_short_manager_month ON records(manager_short_name, put_on_record_date);
        CREATE INDEX IF NOT EXISTS idx_records_scale ON records(manager_scale);
        """
    )


def write_sqlite(records: pd.DataFrame) -> None:
    SQLITE_PATH.parent.mkdir(exist_ok=True, parents=True)
    frame = normalize_records(records)
    with sqlite3.connect(SQLITE_PATH) as conn:
        init_db(conn)
        conn.execute("DELETE FROM records")
        conn.executemany(
            """
            INSERT INTO records (
                fund_no, fund_name, manager_name, manager_short_name,
                manager_type, working_state, put_on_record_date, mandator_name,
                register_no, manager_scale
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    row.fundNo,
                    row.fundName,
                    row.managerName,
                    row.managerShortName,
                    row.managerType,
                    row.workingState,
                    row.putOnRecordDate,
                    row.mandatorName,
                    row.registerNo,
                    row.managerScale,
                )
                for row in frame.itertuples(index=False)
            ],
        )
        conn.commit()


def main() -> None:
    records = load_from_source()
    if not records.empty:
        write_sqlite(records)
    print(f"SQLite updated: {SQLITE_PATH}")


if __name__ == "__main__":
    main()
