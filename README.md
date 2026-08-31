# PfundStatas

Flask + SQLite 私募基金备案数据面板。本地开发默认使用 5002 端口，生产服务部署在 Zeus。

## 运行

```powershell
& .venv\Scripts\python.exe -m pip install -r requirements.txt
& .venv\Scripts\python.exe update_data.py
& .venv\Scripts\python.exe app.py
```

开发服务地址：<http://127.0.0.1:5002>

## Zeus 生产环境

生产服务仅监听 Zeus 回环地址 `127.0.0.1:15002`，通过 SSH 隧道访问：

```powershell
ssh -N -L 127.0.0.1:5002:127.0.0.1:15002 zeus
```

代码提交并推送到 `origin/master` 后，执行以下命令部署：

```powershell
ssh zeus /usr/local/sbin/deploy-pfund-statas
```

只更新备案数据、不修改代码时，执行：

```powershell
ssh zeus systemctl start pfund-statas-update.service
```

Zeus 的目录结构、完整发布流程、状态检查、日志和回滚方法见 [Zeus 运维手册](docs/zeus-operations.md)。

## 数据说明

`update_data.py` 将源数据库中的备案记录及管理人信息同步到本地 SQLite。

- 默认路径：`data/pfund.db`
- `update_data.py` 只从环境变量读取 `SQL_PASSWORDS` 和 `SQL_HOST`，其他连接参数在脚本中配置
- 备案数据的 `registerNo` 对应 `量化私募管理人列表.登记编号`
- `manager_short_name` 来自 `量化私募管理人列表.管理人简称`
- `manager_scale` 来自 `量化私募管理人列表.管理规模`
- 管理人月度表展示 2024 年以来的月度数据、YTD 和滚动近 12 个月数据，并支持 Excel 导出
- 周度图表以周五作为每周日期标签
- 未配置外部数据库凭据时，不覆盖现有 SQLite 数据

## Web 筛选

顶部的“规模50亿元以上”按钮使用以下固定口径：

- `量化私募管理人列表.管理规模 = 100亿元以上`
- `量化私募管理人列表.管理规模 = 50-100亿元`

选中后，摘要指标、周/月趋势图、管理人月度表、备案明细和 Excel 导出会使用同一筛选条件。前端通过 `scale_50_plus=1` 参数调用现有 `/api/*` 接口，不依赖额外生成的 JSON 文件。

升级旧版 SQLite 后，需要执行一次 `update_data.py`，为历史备案记录补齐管理规模。

## 环境变量

- `DATABASE_URL`
- `SQL_USER`
- `SQL_PASSWORDS` or `SQL_PASSWORD`
- `SQL_HOST`
- `SQLITE_PATH`
- `WEB_PORT`
