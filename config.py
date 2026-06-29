import os
from pathlib import Path

from dotenv import load_dotenv


def load_environment() -> None:
    if not os.getenv("GITHUB_ACTIONS"):
        env_file = ".env"
        if os.path.exists(env_file):
            load_dotenv(env_file)


load_environment()

SQL_PASSWORDS = os.getenv("SQL_PASSWORDS")
SQL_HOST = os.getenv("SQL_HOST")

SQLITE_PATH = Path(os.getenv("SQLITE_PATH", "data/pfund.db"))
WEB_PORT = int(os.getenv("WEB_PORT", "5002"))
