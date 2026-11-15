# 发布说明

目标仓库：`sum-oi/drawing-studio`。
目标镜像：`sumcheung/drawing-studio`。

## 一次性配置

1. 创建公开 GitHub 仓库并上传本目录。
2. 在 Docker Hub 的 sumcheung 命名空间创建公开 drawing-studio 仓库。
3. 在 Docker Hub 创建可写入目标仓库的访问令牌。
4. 将令牌添加到 GitHub 仓库 Actions Secret，名称为 `DOCKERHUB_TOKEN`。
   不要将令牌放进文件、提交历史、Issue 或聊天。
5. 启用 GitHub Actions。先让 main 分支的测试和两个架构的容器检查通过。

## 发布

更新 package.json、CHANGELOG.md、.env.example 与 compose.yaml 默认版本，
提交后创建对应标签，例如：

```sh
git tag v0.3.0-beta.1
git push origin v0.3.0-beta.1
```

每种架构的同一个本地镜像先运行容器检查，再推送 commit+架构标签。
只有全部成功，才创建固定版本的多架构清单。
测试版没有 latest 标签。不要移动已经发布的版本标签。

## 验证与失败处理

检查 GitHub Actions 每个任务成功，并确认 Docker Hub 的版本标签存在。
在目标服务器执行 `docker compose pull` 后，用实际域名完成登录、上传、
重启持久化检查。尚未验证的环境不要标为已支持。

若发布失败，保留旧版本使用，修复失败原因后创建新版本。
推送中断时可能留下 commit+架构的中间镜像标签，但不会创建通过门槛前的正式版本清单。
