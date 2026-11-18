---
title: Cấu hình
description: Cách cấu hình Mitra bằng biến môi trường, những biến mà hầu hết máy chủ cần, và mọi biến cùng giá trị mặc định của chúng.
---

Mitra được cấu hình hoàn toàn qua biến môi trường. Không có tệp cấu hình nào để gắn vào: bạn đặt các biến trên container, và Mitra đọc chúng khi khởi động. Mọi biến đều không bắt buộc, và biến nào bạn không đặt sẽ dùng giá trị mặc định ghi [bên dưới](#all-variables).

Với Docker Compose, chúng nằm trong khối `environment`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'
```

Một tệp `.env` hoặc Docker secrets cũng dùng tốt như vậy, nếu bạn muốn giữ bí mật ngoài tệp compose. Thay đổi có hiệu lực vào lần Mitra khởi động tiếp theo:

```bash
docker compose up -d
```

## Máy chủ cần thiết lập gì

Gần như không có gì. Mọi người tự thêm [lịch Mitra](integrations/mitra.md), [CalDAV](integrations/caldav.md), [Lịch Apple](integrations/apple.md), [lịch đăng ký](integrations/subscriptions.md), [Notion](integrations/notion.md), [Todoist](integrations/todoist.md) và [Tempo](integrations/tempo.md) ngay trong ứng dụng.

Hai thứ cần thông tin xác thực mà bạn phải đăng ký với bên khác trước: [Google Lịch](integrations/google.md) (`MITRA_GOOGLE_*`) và [đăng nhập](sso.md) (`MITRA_OIDC_*`).

## Đặt sau HTTPS

Khi Mitra có thể truy cập từ bất cứ đâu ngoài máy của bạn, hãy đặt nó sau một reverse proxy như Caddy, Traefik hoặc nginx, và để proxy xử lý HTTPS. Bản thân Mitra chỉ nói HTTP thường bên trong container. Một số tính năng chỉ hoạt động qua HTTPS:

- Trình duyệt chỉ cho phép [lời nhắc](reminders.md) và [cài đặt ứng dụng](install-app.md) trên các địa chỉ `https://` (và trên `http://localhost`).
- Cookie [đăng nhập](sso.md) chỉ được đánh dấu bảo mật trên `https://`, và hầu hết nhà cung cấp danh tính yêu cầu địa chỉ chuyển hướng `https://`.
- [Google Lịch](integrations/google.md) yêu cầu địa chỉ chuyển hướng `https://`.

Sau đó đặt [`MITRA_URL`](#set-the-public-url) thành địa chỉ công khai.

Với [Caddy](https://caddyserver.com/), chỉ cần thế này:

```caddy
mitra.example.com {
	reverse_proxy localhost:3000
}
```

Với [Traefik](https://traefik.io/), định tuyến đến Mitra bằng các nhãn trên dịch vụ:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    volumes:
      - ~/mitra:/app/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mitra.rule=Host(`mitra.example.com`)"
      - "traefik.http.services.mitra.loadbalancer.server.port=3000"
    environment:
      MITRA_URL: 'https://mitra.example.com'
```

## Đặt địa chỉ công khai

`MITRA_URL` là địa chỉ mọi người gõ vào trình duyệt để truy cập Mitra, không phải địa chỉ nội bộ của container:

```yaml
environment:
  MITRA_URL: 'https://mitra.example.com'
```

Mitra dựng các địa chỉ trả về cho Google Lịch và đăng nhập từ đó, và đánh dấu cookie là bảo mật khi nó bắt đầu bằng `https://`. Bạn có thể bỏ qua khi dùng thử Mitra trên `http://localhost`. Hãy đặt nó ngay khi Mitra có địa chỉ thật, và bạn bắt buộc phải đặt để bật đăng nhập.

## Đặt tên cho phiên bản của bạn

`MITRA_NAME` thay thế “Mitra” trên thanh bên, thẻ trình duyệt và [ứng dụng đã cài](install-app.md):

```yaml
environment:
  MITRA_NAME: 'Family Calendar'
```

Nhấp vào tên sẽ mở hộp thoại **Giới thiệu**, hiện phiên bản và commit bạn đang chạy. [Ứng dụng đã cài](install-app.md) giữ tên và biểu tượng “Mitra”, vì chúng được cố định khi ứng dụng được xây dựng.

## Mọi biến

### Cốt lõi

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `MITRA_URL` | *(chưa đặt)* | [Địa chỉ công khai](#set-the-public-url) mọi người dùng để truy cập Mitra, như `https://mitra.example.com`. Các địa chỉ trả về cho đăng nhập và Google Lịch, cũng như việc cookie có bảo mật hay không, đều lấy từ nó. Không bắt buộc khi bạn dùng thử Mitra trên localhost, bắt buộc cho [đăng nhập](sso.md), và nên có cho [Google Lịch](integrations/google.md) và mọi máy chủ công khai. |
| `MITRA_NAME` | *(Mitra, theo ngôn ngữ của mỗi người)* | [Tên](#name-your-instance) hiện trên thanh bên, thẻ trình duyệt và ứng dụng đã cài. |
| `MITRA_PORT` | `3000` | Cổng mà máy chủ lắng nghe. Với Docker, hãy đổi phía máy chủ của ánh xạ cổng thay vào đó; chỉ đặt biến này khi chính tiến trình phải lắng nghe ở cổng khác. Phần kiểm tra tình trạng tích hợp sẵn theo nó. |
| `MITRA_LOG_LEVEL` | `info` | [Mitra ghi nhật ký nhiều đến đâu](logging.md): `error`, `warn`, `info`, `debug` hoặc `trace`. Mỗi mức bao gồm mọi thứ yên tĩnh hơn nó. |
| `MITRA_UPDATE_CHECK` | *(bật)* | Đặt thành `off` (hoặc `false`, `0`, `no`) để tắt [kiểm tra cập nhật](updates.md). |
| `MITRA_MCP` | *(bật)* | Đặt thành `off` (hoặc `false`, `0`, `no`) để đóng [địa chỉ mà các công cụ AI kết nối đến](ai-connectors.md). |

### Lời nhắc

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `MITRA_VAPID_SUBJECT` | `mailto:mitra@localhost` | Thông tin liên hệ mà các dịch vụ đẩy thấy cho [lời nhắc](reminders.md) của máy chủ bạn, thường là một địa chỉ `mailto:`. Không ai dùng Mitra nhìn thấy nó. Các khóa ký được tạo tự động, nên không có gì khác để đặt. |

### Vị trí

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `MITRA_PHOTON_URL` | `https://photon.komoot.io` | [Bộ mã hóa địa lý Photon](location.md) phía sau trường vị trí. Trỏ nó đến phiên bản Photon của riêng bạn thay vì bản công khai của komoot. |

### Tệp đính kèm

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `MITRA_FILE_MAX_SIZE` | `25M` | Tệp lớn nhất mà một người có thể [đính kèm](attachments.md) vào một mục, tính bằng byte hoặc với hậu tố `k`, `M` hoặc `G`. Đặt thành `0` để tắt việc thêm tệp. |
| `MITRA_FILE_QUOTA` | *(chưa đặt)* | Tổng dung lượng mỗi người có thể lưu trong các tệp đính kèm, viết theo cùng cách. Nếu không có, không có giới hạn. |

### Google Lịch

Đặt cả hai để cho phép mọi người kết nối [Google Lịch](integrations/google.md). Chỉ đặt ID sẽ khiến Mitra không khởi động.

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `MITRA_GOOGLE_CLIENT_ID` | *(chưa đặt)* | ID máy khách OAuth từ Google Cloud console. |
| `MITRA_GOOGLE_CLIENT_SECRET` | *(chưa đặt)* | Bí mật máy khách OAuth. Bắt buộc bất cứ khi nào `MITRA_GOOGLE_CLIENT_ID` được đặt. |

### Đăng nhập một lần

Đặt `MITRA_OIDC_ISSUER` sẽ bật [đăng nhập](sso.md). Nếu thiếu các biến nó cần, Mitra từ chối khởi động.

| Biến | Mặc định | Mô tả |
| --- | --- | --- |
| `MITRA_OIDC_ISSUER` | *(chưa đặt)* | URL của issuer thuộc nhà cung cấp OIDC của bạn. Yêu cầu `MITRA_OIDC_CLIENT_ID` và `MITRA_URL`. |
| `MITRA_OIDC_CLIENT_ID` | *(chưa đặt)* | ID máy khách đã đăng ký tại nhà cung cấp của bạn. |
| `MITRA_OIDC_CLIENT_SECRET` | *(chưa đặt)* | Bí mật máy khách. Bỏ qua với máy khách công khai; Mitra luôn dùng PKCE. |
| `MITRA_OIDC_SCOPES` | `openid profile email` | Các scope Mitra yêu cầu, phân tách bằng dấu cách. `openid` là bắt buộc; `profile` và `email` cho Mitra biết tên và email của mỗi người. |

### Do bản dựng đặt

Bạn không đặt các biến này trên máy chủ. Bản dựng hoặc image đặt chúng, hoặc chúng dành cho việc phát triển chính Mitra.

| Biến | Do ai đặt | Mô tả |
| --- | --- | --- |
| `MITRA_VERSION` | Bản dựng | Phiên bản được tích hợp vào image. |
| `MITRA_COMMIT` | Bản dựng | Commit được tích hợp vào image. |
| `MITRA_DEV` | Phát triển | Cung cấp tích hợp **Bản demo**, một bộ lịch mẫu, khi phát triển Mitra. |
| `NODE_ENV` | Image | `production` trong image container. |

### Ví dụ

Một máy chủ có đăng nhập, Google Lịch và bộ mã hóa địa lý riêng:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_NAME: 'Family Calendar'

      # Sign-in
      MITRA_OIDC_ISSUER: 'https://auth.example.com'
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'

      # Google Calendar
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'

      # Your own geocoder
      MITRA_PHOTON_URL: 'https://photon.internal.example.com'
```
