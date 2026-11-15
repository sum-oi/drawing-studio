# Changelog

## 0.3.0-beta.4

- 去掉登录页的默认账号提示。
- 将页面与四节分步练习的文案改为具体操作、数量和完成要求。
- 明确 M1–M4 是额外的创作演练，说明与原课程的主题关联，以及 M4 后推荐 D85 的原因。
- 原课程详情显示 D 编号；保留原版 252 项任务、编号与已有进度。

## 0.3.0-beta.3

- 账户页支持修改登录账号、密码或同时修改；校验当前密码后注销各设备会话，保留作品和进度。
- 采用奶油纸色、金橄榄静物插图与刊物式排版，调整登录页、课程、日历、作品与账户界面。
- 自动同步期间的操作会等待同步完成，不再忽略退出等点击。
- 新增账号修改、重启与数据保留测试。

## 0.3.0-beta.2

- 默认直接通过内网 IP:4175 使用，无需填写域名、监听 IP 或账号环境变量。
- 自动校验同主机来源，支持保留 Host 的 Lucky HTTPS 反向代理；HTTPS 登录自动设置 Secure Cookie。
- 容器测试覆盖零环境变量启动、登录和持久化。

## 0.3.0-beta.1

Initial public beta:
- Four guided composition lessons and 252 curriculum tasks.
- Private single-account artwork journal and practice calendar.
- Configurable initial username and randomly generated bootstrap password.
- Server-side SQLite persistence, authenticated original-image downloads.
- Revision checks prevent stale devices overwriting newer progress.
- Docker deployment, backup instructions and automated release checks.

Known limits: single account per instance; no model API; most original tasks
remain brief outlines; JSON export has no one-click restore UI. Restore full
instances from offline database backups.
