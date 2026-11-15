# 部署与备份

## 数据位置

默认 Compose 使用命名卷 `studio-data`，实际名称带 Compose 项目前缀。
可用 `docker inspect` 查看挂载，或用：
`docker compose exec drawing-studio ls /app/data`。

目录包括 SQLite 数据库、WAL/SHM（运行时可能存在）、首次登录文件，以及可选的私有反馈连接文件 `feedback-settings.json`。
不要公开或提交这个目录。

## 创建可恢复的完整备份

以下命令在 Linux 服务器项目目录执行。先停止服务，避免 SQLite 写入中复制：

```sh
mkdir -p backups
docker compose stop drawing-studio
docker compose run --rm --no-deps --entrypoint tar drawing-studio -C /app/data -czf - . > backups/studio-data.tar.gz
docker compose start drawing-studio
```

确认 tar 命令成功，并用 `tar -tzf backups/studio-data.tar.gz` 检查内容。
备份包含账号、作品及反馈连接凭据，存放在私人目录。正式使用时按日期另存，避免覆盖唯一备份。

## 恢复

先保留当前卷的备份并停止服务。恢复到空的数据卷或空数据目录；
不要将一个备份与另一个运行中的数据库混合。示例将备份解压到新卷：

```sh
docker volume create drawing-studio-restored
docker run --rm --user 0 --mount type=volume,source=drawing-studio-restored,target=/restore --mount type=bind,source="$(pwd)/backups",target=/backup,readonly --entrypoint sh sumcheung/drawing-studio:0.3.0-beta.1 -c 'tar -xzf /backup/studio-data.tar.gz -C /restore && chown -R 1000:1000 /restore'
```

将 Compose 顶层卷定义改为以下内容，再启动同一版本服务：

```yaml
volumes:
  studio-data:
    external: true
    name: drawing-studio-restored
```

确认登录、练习记录、原图与日历后，再决定是否归档原卷。
恢复命令中的镜像版本应与备份时一致。

## 回退

保留上一版本号及相应数据库备份。更新失败时停服务，
把 Compose 中的镜像标签改回旧版本；如发生数据库迁移则同时恢复迁移前的数据卷。
未经确认不要删除旧卷。

## 公网验收

1. iPad 通过 HTTPS 域名登录，保存一次练习并上传草图。
2. PC 同账号同步，检查练习和原图都能读取。
3. 登出后验证原图链接返回未登录。
4. 关闭并重启容器，确认数据仍在。
5. 从外网重复登录与上传，确认反向代理的请求大小和 Cookie 设置。

每次实例只提供一个账号。若多人需要独立隐私空间，部署不同实例。
