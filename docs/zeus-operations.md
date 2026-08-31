# Zeus 运维手册

本文记录 PfundStatas 在 Zeus 上的生产部署和日常运维流程。代码发布与数据更新是两条独立链路，不要混用。

## 1. 生产架构

```text
云 MySQL（VPC 内网）
  -> Zeus 上的 update_data.py
  -> /var/lib/pfund-statas/data/pfund.db
  -> Gunicorn 127.0.0.1:25002
  -> Nginx 0.0.0.0:15002
  -> 公网 http://120.48.74.113:15002/
     或 SSH 隧道到本机 127.0.0.1:5002
```

- Web 请求只读取 Zeus 本地 SQLite，不会在每次请求时访问云数据库。
- `update_data.py` 在 Zeus 上直接查询云数据库并更新 Zeus 本地的 `pfund.db`。
- 本地开发目录中的 `data/pfund.db` 不会上传或同步到 Zeus。
- Nginx 对公网开放 15002；Gunicorn 仅监听回环地址 25002，不直接暴露到公网。
- 生产服务不再使用 `pfundstatas` FRP 代理。
- 当前公网入口使用 HTTP，没有 HTTPS 或登录认证，任何能访问该 IP 和端口的人都能打开页面。
- 当前没有自动更新数据的 timer；数据更新由管理员手动触发。

## 2. 生产目录和服务

| 项目 | 位置或名称 |
| --- | --- |
| Git checkout | `/opt/pfund-statas/app` |
| Python 虚拟环境 | `/opt/pfund-statas/venv` |
| 环境变量 | `/var/lib/pfund-statas/.env` |
| SQLite 数据库 | `/var/lib/pfund-statas/data/pfund.db` |
| 代码部署脚本 | `/usr/local/sbin/deploy-pfund-statas` |
| Web systemd 服务 | `pfund-statas.service` |
| 数据更新 systemd 服务 | `pfund-statas-update.service` |
| Web systemd 文件 | `/etc/systemd/system/pfund-statas.service` |
| 数据更新 systemd 文件 | `/etc/systemd/system/pfund-statas-update.service` |
| Nginx 配置 | `/etc/nginx/conf.d/pfund-statas.conf` |
| Nginx 访问日志 | `/var/log/nginx/pfund-statas.access.log` |
| Nginx 错误日志 | `/var/log/nginx/pfund-statas.error.log` |

代码目录和部署脚本由 `root` 管理；Web 和数据更新进程使用无登录权限的 `pfund-statas` 用户运行。`.env` 和 `pfund.db` 不属于 Git checkout，不会被 `git pull` 覆盖。

## 3. 从本地发布代码

### 3.1 本地修改、验证、提交和推送

在 `W:\WorkSpace\PfundStatas` 中完成修改。先检查工作树，只暂存本次涉及的文件：

```powershell
git status --short --branch
& .\.venv\Scripts\python.exe -m py_compile app.py config.py update_data.py
git add README.md docs/zeus-operations.md
git commit -m "说明本次修改"
git push origin master
```

根据修改范围补充必要的接口或页面验证。不要使用笼统的 `git add .` 将无关文件带入提交。

### 3.2 让 Zeus 拉取并运行新代码

确认 `git push` 成功后执行：

```powershell
ssh zeus /usr/local/sbin/deploy-pfund-statas
```

部署脚本会按顺序执行：

1. 确认 `/opt/pfund-statas/app` 是干净的 Git checkout；脏工作树会直接拒绝部署。
2. 从 `origin/master` 获取更新，并仅允许 fast-forward。
3. 安装 `requirements.txt` 中的依赖，并确保生产环境使用 `gunicorn==23.0.0`。
4. 对 `app.py`、`config.py` 和 `update_data.py` 执行 Python 语法检查。
5. 重启 `pfund-statas.service`。
6. 最多等待 15 秒，通过 Nginx 检查 `http://127.0.0.1:15002/api/dashboard`。

部署成功时会输出切换前后的 Git commit。代码部署不会自动运行 `update_data.py`，也不会改变 `.env` 或 `pfund.db`。

### 3.3 核对 Zeus 上的代码版本

```powershell
ssh zeus "git -C /opt/pfund-statas/app status --short --branch"
ssh zeus "git -C /opt/pfund-statas/app rev-parse HEAD"
```

正常状态应为干净的 `master...origin/master`。不要直接在 Zeus 的 checkout 中编辑代码；修改应在本地完成、提交并推送后再部署。

## 4. 更新备案数据

只更新数据时，不需要 Git 操作，也不需要重启 Web 服务：

```powershell
ssh zeus systemctl start pfund-statas-update.service
```

该 oneshot 服务运行：

```text
/opt/pfund-statas/venv/bin/python /opt/pfund-statas/app/update_data.py
```

并将结果写入：

```text
/var/lib/pfund-statas/data/pfund.db
```

检查最近一次更新结果：

```powershell
ssh zeus "systemctl show pfund-statas-update.service -p Result -p ExecMainCode -p ExecMainStatus"
ssh zeus "journalctl -u pfund-statas-update.service -n 30 --no-pager"
```

成功的 oneshot 服务执行结束后显示 `inactive (dead)` 是正常现象；应以 `Result=success`、`ExecMainStatus=0` 和日志中的 `SQLite updated` 为准。更新失败时，先检查云数据库网络、凭据和 SQL 错误，不要反复盲目重试。

## 5. 访问生产页面

公网可直接访问：<http://120.48.74.113:15002/>。

也可以在本机 PowerShell 中建立 SSH 隧道：

```powershell
ssh -N -L 127.0.0.1:5002:127.0.0.1:15002 zeus
```

保持该窗口运行，然后打开 <http://127.0.0.1:5002>。该隧道连接到 Zeus 的 Nginx 入口。如果 5002 已被占用，先检查占用进程：

```powershell
Get-NetTCPConnection -State Listen -LocalPort 5002
```

不要同时启动本地 `app.py` 和占用同一端口的 SSH 隧道。

## 6. 状态和日志检查

检查 Web、Nginx 服务和监听端口：

```powershell
ssh zeus "systemctl status pfund-statas.service --no-pager"
ssh zeus "systemctl status nginx.service --no-pager"
ssh zeus "ss -ltnp | grep -E ':(15002|25002)'"
```

正常情况下，两个服务均为 `active (running)`；Nginx 监听 `0.0.0.0:15002` 和 `[::]:15002`，Gunicorn 只监听 `127.0.0.1:25002`。

查看 Web 服务最近日志：

```powershell
ssh zeus "journalctl -u pfund-statas.service -n 100 --no-pager"
ssh zeus "tail -n 100 /var/log/nginx/pfund-statas.error.log"
```

直接在 Zeus 上检查接口：

```powershell
ssh zeus "curl -fsS http://127.0.0.1:15002/api/dashboard"
ssh zeus "curl -fsS 'http://127.0.0.1:15002/api/records?size=1'"
```

如果部署脚本健康检查失败，先查看 `systemctl status` 和 `journalctl`，确认是依赖、语法、端口还是运行时错误，再决定修复或回滚。

## 7. 回滚代码

推荐通过 Git 创建可追踪的反向提交，而不是在 Zeus 上直接修改或强制重置：

```powershell
git revert BAD_COMMIT_SHA
git push origin master
ssh zeus /usr/local/sbin/deploy-pfund-statas
```

执行前将 `BAD_COMMIT_SHA` 替换为需要撤销的提交号。

首次切换为 Git checkout 时保留了一份旧 `scp` 部署目录：

```text
/opt/pfund-statas/app.scp-backup-20260831-130348
```

该目录仅用于紧急人工恢复，不会自动更新，不能当作长期版本管理方式。进行目录级恢复前，应先检查当前服务、Git commit、数据目录和实际故障原因。

## 8. 常用命令速查

```powershell
# 发布已经 push 到 origin/master 的代码
ssh zeus /usr/local/sbin/deploy-pfund-statas

# 更新云数据库数据到 Zeus 本地 SQLite
ssh zeus systemctl start pfund-statas-update.service

# 查看 Web 服务
ssh zeus "systemctl status pfund-statas.service --no-pager"

# 查看数据更新日志
ssh zeus "journalctl -u pfund-statas-update.service -n 30 --no-pager"

# 建立本机 5002 到 Zeus 15002 的 SSH 隧道
ssh -N -L 127.0.0.1:5002:127.0.0.1:15002 zeus
```
