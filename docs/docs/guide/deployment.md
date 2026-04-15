# 部署指南

## 架构概览

```
本地开发（无需域名/HTTPS）:
  localhost:6066  ← backend（直接访问）
  localhost:80    ← dashboard nginx（/api/* → backend）

生产部署（可选 HTTPS）:
  Internet → Traefik :80/:443 → dashboard nginx → backend
                                                 → db / redis
```

Traefik 和 HTTPS 只在**部署到公网**时需要，本地开发完全不涉及。

---

## 环境变量说明

完整配置文件位于 `backend/.env.example`。

### 本地开发（默认值即可，无需修改）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgresql://postgres:postgres@db:5432/share_installs` | PostgreSQL 连接串 |
| `REDIS_URL` | `redis://redis:6379` | Redis 连接串 |
| `FRONTEND_URL` | `http://localhost:5173` | 影响 Cookie Secure 标志，本地用 http 即可 |
| `MULTI_TENANT` | `false` | 自建模式，无需 API Key |

### 生产环境需要额外填写

| 变量 | 说明 |
|------|------|
| `FRONTEND_URL` | 改为 `https://你的域名`，Cookie 才能正常工作 |
| `JWT_SECRET` | Session 签名密钥，随机长字符串 |
| `ENCRYPTION_KEY` | API Key 加密密钥，64 位十六进制字符串 |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `ACME_EMAIL` | Let's Encrypt 证书申请邮箱（使用 Traefik HTTPS 时必填） |

生成密钥：

```bash
# JWT_SECRET 和 ENCRYPTION_KEY 都用这个命令生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 限流配置

| 变量 | 默认 | 说明 |
|------|------|------|
| `RATE_LIMIT_WINDOW_MS` | `900000`（15 分钟） | 通用限流窗口 |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | 窗口内最大请求数 |
| `RATE_LIMIT_RESOLVE_MAX` | `10` | `/v1/resolutions` 每分钟最大请求数 |

> 开发模式（`NODE_ENV=development`）下限流自动禁用。

### 指纹匹配

| 变量 | 默认 | 说明 |
|------|------|------|
| `FINGERPRINT_MATCH_TTL_HOURS` | `72` | 点击事件保留时长（小时） |
| `FINGERPRINT_MATCH_THRESHOLD` | `0.75` | 模糊匹配最低置信度（0.0–1.0） |

---

## 本地开发

### 启动（跳过 Traefik）

```bash
# 只跑后端 + 数据库 + 缓存
docker compose up backend db redis --build

# 同时跑前端控制台
docker compose up backend db redis dashboard --build
```

| 服务 | 地址 |
|------|------|
| 后端 API | `http://localhost:6066` |
| 前端控制台 | `http://localhost:80` |
| 健康检查 | `http://localhost:6066/api/health` |

### 热重载模式

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

开发模式下限流自动禁用，日志级别更详细。

### Mac Docker Desktop：Traefik socket 报错

如果你在 Mac 上运行了完整的 `docker compose up`（包含 Traefik），会看到：

```
traefik-1 | ERR Failed to retrieve information of the docker client and server
            error="Error response from daemon: "
```

**原因：** Mac 上 Docker Desktop 的 socket 路径与 Linux 服务器不同。

**解决方法一（推荐）：** 本地直接跳过 Traefik，不要运行完整的 `docker compose up`，改用上面的按需启动命令。

**解决方法二：** 先确认本机实际路径：

```bash
docker context inspect | grep -i sock
# 输出类似: "Host": "unix:///Users/yourname/.docker/run/docker.sock"
```

然后修改 `docker-compose.yml` 中 Traefik 的挂载：

```yaml
traefik:
  volumes:
    - /Users/yourname/.docker/run/docker.sock:/var/run/docker.sock:ro
    - acme-data:/acme
```

> Linux 服务器保持 `/var/run/docker.sock` 不变，不要提交这个本地改动。

---

## 生产部署（带 HTTPS）

HTTPS 和域名配置是**可选的**，仅在将服务部署到公网时需要。

### 前置条件

1. 服务器开放 80 和 443 端口
2. DNS 已将域名 A 记录指向服务器 IP

### 第 1 步：填写 `.env`

```env
FRONTEND_URL=https://console.your-domain.com
JWT_SECRET=<随机字符串>
ENCRYPTION_KEY=<64位十六进制>
GITHUB_CLIENT_ID=<你的 GitHub OAuth Client ID>
GITHUB_CLIENT_SECRET=<你的 GitHub OAuth Client Secret>
ACME_EMAIL=your@email.com
```

### 第 2 步：修改 `docker-compose.yml` 中的域名

将 `console.share-installs.com` 替换为你的实际域名：

```yaml
labels:
  - "traefik.http.routers.dashboard-http.rule=Host(`console.your-domain.com`)"
  - "traefik.http.routers.dashboard-https.rule=Host(`console.your-domain.com`)"
```

### 第 3 步：启动完整服务

```bash
docker compose up --build -d
docker compose logs -f traefik  # 观察证书申请过程（首次需要约 30 秒）
```

证书申请完成后，访问 `https://console.your-domain.com` 应显示控制台。

---

## GitHub OAuth 配置（控制台登录用）

在 [GitHub Developer Settings](https://github.com/settings/developers) 创建 OAuth App：

| 字段 | 本地开发 | 生产环境 |
|------|----------|----------|
| Homepage URL | `http://localhost:80` | `https://console.your-domain.com` |
| Authorization callback URL | `http://localhost:6066/api/auth/github/callback` | `https://console.your-domain.com/api/auth/github/callback` |

---

## 健康检查

```bash
# 本地
curl http://localhost:6066/api/health

# 生产
curl https://console.your-domain.com/api/health
```

```json
{
  "status": "ok",
  "mode": "self-hosted",
  "version": "1.0.0",
  "timestamp": "2026-04-15T00:00:00.000Z"
}
```

---

## 数据备份

PostgreSQL 数据存储在 Docker volume `postgres-data`，重建容器不会丢失。

```bash
# 备份
docker exec share-installs-db-1 pg_dump -U postgres share_installs > backup.sql

# 恢复
docker exec -i share-installs-db-1 psql -U postgres share_installs < backup.sql
```
