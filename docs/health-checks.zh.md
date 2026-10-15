---
title: 健康检查
description: 告诉编排系统、负载均衡器和可用性监控 Mitra 是否在正常提供服务的端点，以及基于它的 Docker 健康检查。
---

对于任何监控 Mitra 的系统，Mitra 都会回答一个问题：这个实例是否在正常提供服务？向下面这个地址发出请求即可，无需登录：

```text
GET /api/health
```

它只检查 Mitra 运行所必不可少的一样东西，也就是数据库：

| 响应 | 含义 |
| --- | --- |
| `200` `{"status":"ok"}` | 服务正常，数据库有响应。 |
| `503` `{"status":"error"}` | 服务不可用，数据库没有响应或响应超时。 |

响应内容刻意保持精简。它不包含任何版本或构建信息，以免让陌生人知道你运行的是什么；它也从不被缓存，因此每次检查看到的都是当前状态。

已连接的服务，比如 CalDAV 服务器、Notion、Google、你的登录服务提供商或地理编码服务，不在检查范围之内。它们中任何一个短暂中断，都不应该让 Mitra 本身被标记为不健康。

## Docker

镜像中已经内置了使用这个端点的 Docker 健康检查，所以无需任何设置，`docker ps` 和 `docker inspect` 就能显示 Mitra 的真实健康状态。新容器会先显示 `starting`，数据库就绪后变为 `healthy`。如果你修改过 [`MITRA_PORT`](configuration.md)，健康检查也会随之使用新端口。

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

把存活探针和就绪探针都指向这个端点：

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  periodSeconds: 10
```

## 可用性监控

任何 HTTP 监控工具，比如 Uptime Kuma、Healthchecks.io 或负载均衡器自带的检查，都可以轮询 `/api/health`，并把 `200` 以外的任何响应视为服务宕机。无论是否开启[登录](sso.md)，它都同样适用。
