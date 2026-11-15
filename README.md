# 生长之间 · Drawing Studio

自托管的绘画练习室：把课程、练习记录、作品和复盘放在同一处。
适合在 iPad 与 PC 上使用同一个账号，按自己的节奏练习。

**公开测试版：0.3.0-beta.4。** 当前每个实例支持一个私人账号。

## 功能

- 四次连贯的构图试练：情绪关系 → 六种构图 → 三档明度 → 小幅插画。
- 每课提供目标、30 分钟步骤、原创示意图、扩展练习和自评标准。
- 252 项中级绘画课程，按专题浏览、自由选课和重复训练。
- 签到与课程完成分别记录；支持晋级自评、日历、练习札记。
- 保存 JPG、PNG、WebP 原图，按课程关联草图、过程图和成品。
- SQLite 持久化；作品访问需要登录；跨设备修改使用版本冲突检测。
- 完整 JSON 导出和旧预览练习记录导入。
- 在“账户与备份”修改账号与密码，可单独修改或同时修改；已有作品和进度保留。
- 奶油纸色、金橄榄色静物插图和刊物式排版，适配电脑与平板。

没有接入模型服务。大部分 252 项原课程仍是简要任务，尚未全部扩写。
JSON 导出目前没有一键恢复界面，完整实例通过数据库备份恢复。

## Docker 部署

镜像：`sumcheung/drawing-studio:0.3.0-beta.4`。
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
新增课程编辑 `public/lessons.json`，原课程在 `public/course.json`。

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
