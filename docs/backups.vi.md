---
title: Bản sao lưu
description: Mọi thứ Mitra lưu trữ nằm trong một thư mục. Hãy sao lưu nó bằng công cụ bạn đã dùng.
---

Mitra giữ mọi thứ trong một thư mục: `/app/data` bên trong container, tức là `~/mitra` trên máy chủ nếu bạn làm theo [Bắt đầu](README.md#install-mitra). Sao lưu thư mục đó là bạn đã sao lưu toàn bộ phiên bản. Không có máy chủ cơ sở dữ liệu cần dump và không có tệp cấu hình cần nhặt riêng.

> [!CAUTION]
> Với một số thứ bạn giữ trong Mitra, thư mục này là bản duy nhất. Mọi mục trong một [lịch Mitra](integrations/mitra.md) chỉ nằm ở đây và không nơi nào khác. Cũng vậy với các tài khoản và phiên đăng nhập của bạn, thông tin xác thực của các tài khoản đã kết nối, cài đặt của bạn, màu sắc, thứ tự và tên các lịch, [thời gian khả dụng](availability.md) của bạn, thứ tự công việc, [các tệp bạn đã đính kèm](attachments.md) vào mục, một số liên kết giữa các mục, và khóa mà [lời nhắc](reminders.md) trên các thiết bị của bạn phụ thuộc vào. Nếu bạn mất thư mục, nhà cung cấp có thể trả lại các sự kiện và công việc của họ, nhưng không còn gì khác.

## Sao lưu

Hãy trỏ công cụ bạn đang dùng vào thư mục: [restic](https://restic.net/), [Borg](https://www.borgbackup.org/), `rsync`, một snapshot hệ thống tệp hoặc máy ảo, hoặc một tệp lưu trữ thông thường.

Bản sao an toàn nhất là bản được tạo khi Mitra đang dừng:

```bash
docker compose stop mitra
restic backup ~/mitra        # or: tar czf mitra-backup.tar.gz -C ~/mitra .
docker compose start mitra
```

Nếu bạn không thể dừng nó, sao chép thư mục khi Mitra đang chạy thường vẫn ổn, vì SQLite xử lý tốt việc này. Snapshot hệ thống tệp hoặc máy ảo cho bạn một bản sao nhất quán mà không cần dừng gì.

## Khôi phục

Dừng Mitra, đặt thư mục trở lại, rồi khởi động lại:

```bash
docker compose stop mitra
restic restore latest --target ~/mitra        # or extract your archive there
docker compose start mitra
```

Hãy khôi phục thư mục như một tổng thể. Các tệp của nó thuộc về nhau, và trộn các tệp từ những ngày khác nhau có thể làm hỏng phiên bản. Bản sao lưu từ một phiên bản cũ hơn khôi phục tốt lên image mới hơn, vì Mitra cập nhật cơ sở dữ liệu khi khởi động.

## Những gì bản sao lưu không bao gồm

Các sự kiện và công việc trong tài khoản đã kết nối, như máy chủ [CalDAV](integrations/caldav.md), [Google Lịch](integrations/google.md) hay [Notion](integrations/notion.md), nằm ở nhà cung cấp của chúng. Bản sao lưu bao gồm bản sao của Mitra về chúng, và sau khi khôi phục Mitra đồng bộ chúng lại.

Các biến môi trường của bạn nằm trong tệp `compose.yaml` hoặc `.env`, không phải trong thư mục dữ liệu. Hãy giữ an toàn cả chúng, trong hệ thống quản lý phiên bản hoặc kho bí mật của bạn.
