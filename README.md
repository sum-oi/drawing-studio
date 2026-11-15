# 生长之间 · Drawing Studio

自托管的绘画练习室：把课程、练习记录、作品和复盘放在同一处。
适合在 iPad 与 PC 上使用同一个账号，按自己的节奏练习。

**公开测试版：0.3.0-beta.1。** 当前每个实例支持一个私人账号。

## 功能

- 四次连贯的构图试练：情绪关系 → 六种构图 → 三档明度 → 小幅插画。
- 每课提供目标、30 分钟步骤、原创示意图、扩展练习和自评标准。
- 252 项中级绘画课程，按专题浏览、自由选课和重复训练。
- 签到与课程完成分别记录；支持晋级自评、日历、练习札记。
- 保存 JPG、PNG、WebP 原图，按课程关联草图、过程图和成品。
- SQLite 持久化；作品访问需要登录；跨设备修改使用版本冲突检测。
- 完整 JSON 导出和旧预览练习记录导入。

没有接入模型服务。大部分 252 项原课程仍是简要任务，尚未全部扩写。
JSON 导出目前没有一键恢复界面，完整实例通过数据库备份恢复。

## Docker 部署

镜像：`sumcheung/drawing-studio:0.3.0-beta.1`。
发布工作流分别测试 `linux/amd64` 和 `linux/arm64` 镜像，
均通过后才推送固定版本标签。

下载本仓库的 `compose.yaml` 与 `.env.example`，复制配置：

```sh
cp .env.example .env
# 编辑 .env，填写你自己的 HTTPS 域名和首次创建的账号名
docker compose pull
docker compose up -d
docker compose exec drawing-studio cat /app/data/bootstrap.txt
```

最后一条命令仅在你自己的终端显示随机初始密码。通过域名登录后，
在“账户与备份”修改密码，初始化文件会自动删除。

默认使用 Docker 命名卷保存数据；镜像和公开仓库不包含账号或作品。
`INIT_USERNAME` 只在首次初始化时生效，已有数据库不会随环境变量改名。
本项目不会把真实密码放入镜像或环境变量。

### 接入已有 HTTPS 反向代理

```dotenv
APP_ORIGINS=https://draw.example.com
COOKIE_SECURE=true
INIT_USERNAME=artist
BIND_ADDRESS=127.0.0.1
IMAGE_TAG=0.3.0-beta.1
```

将示例域名替换为实际地址，不带路径和末尾斜杠。
让反向代理转发到宿主机 4175 端口，保留 Cookie 和 Origin 请求头；
上传请求体上限至少 16 MB，超时至少 60 秒。应用限制单图 10 MB。

默认只监听宿主机回环地址。若反向代理在另一台机器或容器，
将 `BIND_ADDRESS` 改为可达的宿主机 LAN 地址，或者使用共同的 Docker
网络；限制后端端口只接受反向代理流量。不要将 HTTP 后端直接暴露到公网。
内网与外网使用同一 HTTPS 域名，访问同一实例的数据。

临时局域网 HTTP 试用时，把 `APP_ORIGINS` 设置成实际 HTTP 地址，
同时设 `COOKIE_SECURE=false`；正式域名部署改回 HTTPS。

### 从源码构建

```sh
git clone https://github.com/sum-oi/drawing-studio.git
cd drawing-studio
cp .env.example .env
# 填写 .env
docker compose -f compose.yaml -f compose.build.yaml up -d --build
```

## 更新、备份与恢复

更新前先备份数据，修改 `.env` 中的 `IMAGE_TAG` 为目标版本：

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
