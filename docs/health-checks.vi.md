---
title: Kiểm tra tình trạng
description: Endpoint cho các bộ điều phối, bộ cân bằng tải và công cụ giám sát thời gian hoạt động biết Mitra có đang phục vụ hay không, và kiểm tra tình trạng của Docker xây dựng trên nó.
---

Mitra trả lời một câu hỏi cho bất cứ thứ gì giám sát nó: phiên bản này có đang phục vụ không? Hãy hỏi tại địa chỉ này, không cần đăng nhập:

```text
GET /api/health
```

Nó kiểm tra thứ duy nhất Mitra không thể thiếu, cơ sở dữ liệu của nó:

| Phản hồi | Ý nghĩa |
| --- | --- |
| `200` `{"status":"ok"}` | Đang phục vụ. Cơ sở dữ liệu trả lời. |
| `503` `{"status":"error"}` | Không phục vụ. Cơ sở dữ liệu không trả lời, hoặc mất quá lâu. |

Câu trả lời cố ý trần trụi. Nó không mang thông tin phiên bản hay bản dựng nào cho người lạ biết bạn đang chạy gì, và nó không bao giờ được lưu đệm, nên mỗi lần kiểm tra đều thấy trạng thái hiện tại.

Các dịch vụ đã kết nối, như máy chủ CalDAV, Notion, Google, nhà cung cấp đăng nhập hay bộ mã hóa địa lý của bạn, không nằm trong việc kiểm tra. Một sự cố ngắn ở một trong số đó không nên khiến chính Mitra bị đánh dấu là không khỏe.

## Docker

Image đã có sẵn một kiểm tra tình trạng của Docker dùng endpoint này, nên `docker ps` và `docker inspect` hiện tình trạng thật của Mitra mà không cần thiết lập gì. Container mới hiện `starting`, rồi `healthy` khi cơ sở dữ liệu sẵn sàng. Nó theo [`MITRA_PORT`](configuration.md) nếu bạn đã đổi.

```bash
curl -f http://localhost:3000/api/health   # fails unless Mitra is healthy
docker inspect --format '{{.State.Health.Status}}' mitra
```

## Kubernetes

Trỏ cả liveness probe và readiness probe vào endpoint:

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

## Công cụ giám sát thời gian hoạt động

Bất kỳ công cụ giám sát HTTP nào, như Uptime Kuma, Healthchecks.io hay kiểm tra riêng của bộ cân bằng tải, đều có thể thăm dò `/api/health` và coi mọi thứ khác `200` là ngừng hoạt động. Nó hoạt động như nhau dù có hay không có [đăng nhập](sso.md).
