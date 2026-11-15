# 生长之间 · Drawing Studio

自托管的绘画练习室：把课程、练习记录、作品和复盘放在同一处。
适合在 iPad 与 PC 上使用同一个账号，按自己的节奏练习。

**公开测试版：0.4.0-beta.2。** 当前每个实例支持一个私人账号。

## 功能

- 252 节中级绘画练习，按线条、动作、构图、配色等 9 类内容选课。
- 每课提供准备材料、具体步骤、文字例子、检查方法和卡住时的处理建议。
- 新用户从构图 D85 开始，也可以自由换课；旧版 M1–M4 的记录和作品保留。
- 签到与课程完成分别记录；支持晋级自评、日历、练习札记。
- 保存 JPG、PNG、WebP 原图，按课程关联草图、过程图和成品。
- SQLite 持久化；作品访问需要登录；跨设备修改使用版本冲突检测。
- 完整 JSON 导出和旧预览练习记录导入。
- 在“账户与备份”修改账号与密码，可单独修改或同时修改；已有作品和进度保留。
- 奶油纸色、金橄榄色静物插图和刊物式排版，适配电脑与平板。
- 在课程末尾或“我的反馈”提交问题；可选连接 GitHub 私有仓库，在网页查看维护者回复与处理状态。

没有接入模型服务。课程内容随版本更新，反馈由维护者处理，暂不提供自动点评。
JSON 导出目前没有一键恢复界面，完整实例通过数据库备份恢复。

## Docker 部署

镜像：`sumcheung/drawing-studio:0.4.0-beta.2`。
发布工作流分别测试 `linux/amd64` 和 `linux/arm64` 镜像，
均通过后才推送固定版本标签。

下载本仓库的 `compose.yaml`，在该目录执行：

```sh
docker compose up -d
docker compose exec drawing-studio cat /app/data/bootstrap.txt
```

浏览器打开 `http://服务器内网IP:4175`，默认用户名为 `artist`。
最后一条命令显示随机初始密码。登录后在“账户与备份”修改密码。
默认使用 Docker 命名卷保存数据，无需创建 `.env`。

### Lucky / HTTPS 反向代理（可选）

在 Lucky 中将你的域名转发到 `http://应用服务器内网IP:4175`。
反代可以运行在另一台服务器。保留原始 Host、Origin 和 Cookie 请求头，
上传请求体上限至少 16 MB，超时至少 60 秒。应用限制单图 10 MB。

应用默认校验请求来源与访问的主机名、端口一致；HTTP 内网登录和 HTTPS
域名登录均可使用。HTTPS 登录自动设置 Secure Cookie，无需预填域名。

需要固定来源白名单或自定义首次账号时，可在 Compose 的 `environment`
中按需设置 `APP_ORIGINS`、`COOKIE_SECURE`、`INIT_USERNAME`，见 `.env.example`
内的可选配置说明。默认部署不需要这些设置。已有账号不随环境变量改名。

### 从源码构建

```sh
git clone https://github.com/sum-oi/drawing-studio.git
cd drawing-studio
docker compose -f compose.yaml -f compose.build.yaml up -d --build
```

## 更新、备份与恢复

更新前先备份数据，修改 `compose.yaml` 中的镜像标签为目标版本：

```sh
docker compose pull
docker compose up -d
```

账户页可下载含作品原图的 JSON 导出。完整备份和恢复步骤见
[部署与备份](docs/DEPLOYMENT.md)。普通更新保留命名卷；
不要使用 `docker compose down -v` 删除作品数据。

## 本地开发

需要 Node.js 24，无第三方运行时依赖：

```sh
npm test
node server.cjs
```

默认打开 `http://localhost:4175`，初始用户名为 `artist`，
密码在 `data/bootstrap.txt`。本地数据被 Git 和 Docker 构建排除。
课程在 `public/course.json`。修改内容时保留 D 编号，避免已有记录关联到其他课程。
`public/lessons.json` 仅保留旧版四课的数据兼容，不再作为选课入口。

## 私有用户反馈（可选）

基础课程、记录与作品功能无需额外配置。反馈连接在网页中设置，无需修改 Compose：

打开“账户与备份 → 设置反馈连接”，展开“查看详细教程：创建令牌并连接”，可跟着网页上的步骤操作。

1. 在 GitHub 创建独立的私有仓库，并开启 Issues。
2. 创建仅能访问该仓库的 fine-grained personal access token，授予 **Issues: Read and write**；Metadata 保留默认读取权限。
3. 登录应用，进入“账户与备份 → 设置反馈连接”，填写 `账号/仓库名`、令牌和当前登录密码。
4. 提交一条反馈，在“我的反馈”确认已发送；维护者在私有仓库回复后，点击“查看最新回复”。

使用者无需 GitHub 账号。只发送反馈文字和课程编号，不发送作品、账号密码或练习历史。
未连接或网络失败时，反馈留在本地；恢复后点击“重新发送”或“查看最新回复”。
令牌只保存在数据目录的 `feedback-settings.json`，不会回传给浏览器或写入 JSON 导出。
配置请通过 HTTPS 或可信内网进行。完整数据目录备份会包含此连接文件，应妥善保管。

维护者可在获授权的对话中读取 Issues、回复并发布课程修订。应用不会自行让编程助手常驻处理反馈，
也不会根据用户留言自动修改或部署代码。每次发布的改动和对应版本应回复在原反馈中。

GitHub 权限依据：[创建 Issue 的令牌权限](https://docs.github.com/en/rest/issues/issues#create-an-issue)。

## 发布流程

普通分支与 PR：接口测试、公开文件检查、两种架构的容器测试。
版本标签：测试同一镜像后推送 Docker Hub，再合并为固定版本标签。
不会把测试版自动覆盖到 `latest`。

配置与首次发布步骤见 [发布说明](docs/RELEASING.md)。
容器检查覆盖登录、上传、权限、冲突、重启持久化与导出；
它不能代替 iPad 真机、反向代理或教学效果评估。

## 许可证

代码、仓库内原创课程文本与几何示意图使用 [MIT](LICENSE)。
第三方画师作品不随仓库分发；上传者的作品不属于开源发布内容。
详见 [内容授权范围](CONTENT_LICENSE.md)。
