---
title: Bắt đầu
description: Cài đặt Mitra bằng Docker Compose, có lịch đầu tiên của bạn, và một vài điều để thử.
sidebar:
  label: Bắt đầu
---

Mitra là một lịch tự lưu trữ cho các sự kiện và công việc của bạn. Để xem thử trước, hãy [dùng bản demo](https://demo.mitracal.com).

## Cài đặt Mitra

Với [Docker](https://docs.docker.com/get-docker/) và plugin Compose của nó, hãy tạo một tệp `compose.yaml`:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    volumes:
      - ~/mitra:/app/data
```

Chạy `docker compose up -d` và mở [http://localhost:3000](http://localhost:3000).

Trước khi dựa vào nó, hãy [sao lưu](backups.md) `~/mitra` và [đặt nó sau HTTPS](configuration.md#put-it-behind-https). Nếu người khác sẽ dùng, hãy bật [đăng nhập](sso.md) trước, vì bật sau sẽ khiến mọi người bắt đầu lại với một tài khoản trống.

## Có một lịch

Mitra đề nghị thêm một lịch khi bạn mở nó lần đầu: một [lịch Mitra](integrations/mitra.md) lưu trên máy chủ của bạn, hoặc một tài khoản bạn đã có, chẳng hạn [CalDAV](integrations/caldav.md) hoặc [Google Lịch](integrations/google.md).

## Một vài điều để thử

- Kéo ngang qua một giờ trống trong [chế độ xem tuần](views/week.md) để tạo một sự kiện.
- Nhấn **Thêm công việc** trong tab [Kế hoạch](planning.md) của thanh bên, rồi sau đó kéo công việc vào tuần của bạn.
- Nhấn <kbd>/</kbd> và chạy **Thêm thời gian khả dụng** để tô bóng [giờ làm việc](availability.md) của bạn.
- [Cài đặt Mitra trên điện thoại](install-app.md) để nhận [lời nhắc](reminders.md).
- Nhấn <kbd>?</kbd> để xem mọi [phím tắt](shortcuts.md).
