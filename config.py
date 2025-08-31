# config.py
import os
from dotenv import load_dotenv

def load_environment():
    # 自动检测环境（优先使用 GitHub Actions 的环境变量）
    if not os.getenv('GITHUB_ACTIONS'):  # 非 CI 环境
        env_file = '.env'
        if os.path.exists(env_file):
            load_dotenv(env_file)
        else:
            print(f"⚠️ Warning: {env_file} not found. Using system environment variables")

# 初始化环境
load_environment()

# 获取环境变量（统一访问点）
SQL_PASSWORDS = os.getenv('SQL_PASSWORDS')
SQL_HOST = os.getenv('SQL_HOST')
APPID = os.getenv('APPID')
APPKEY = os.getenv('APPKEY')# 获取环境变量（统一访问点）
SEND = os.getenv("SEND")
PASS = os.getenv("PASS")
RECV = os.getenv("RECV")

# 支持多个收件人（逗号分隔）
if RECV:
    RECV = [email.strip() for email in RECV.split(",") if email.strip()]
else:
    RECV = []