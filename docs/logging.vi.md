---
title: Ghi nhật ký
description: Chọn mức Mitra ghi nhật ký bằng MITRA_LOG_LEVEL, và mức nào giúp ích cho vấn đề nào.
---

Mitra ghi nhật ký ra đầu ra chuẩn, nên `docker compose logs` hiện mọi thứ:

```bash
docker compose logs -f mitra
```

Một máy chủ khỏe mạnh cố ý yên ắng: theo mặc định nó chỉ ghi những gì quan trọng. Hãy tăng mức lên khi bạn truy tìm một vấn đề, và hạ xuống khi xong việc.

## Đặt mức

```yaml
environment:
  MITRA_LOG_LEVEL: 'debug'
```

Mỗi mức bao gồm mọi thứ yên ắng hơn nó:

| `MITRA_LOG_LEVEL` | Bạn nhận được gì |
| --- | --- |
| `error` | Chỉ các lỗi. |
| `warn` | Thêm các vấn đề Mitra đã xử lý được, như một lời nhắc không gửi được, một bộ mã hóa địa lý không trả lời, hoặc một nhà cung cấp đăng nhập không kết nối được. |
| `info` *(mặc định)* | Thêm những gì quan trọng hằng ngày: khởi động, đăng nhập, tài khoản được kết nối, thay đổi được đồng bộ từ nhà cung cấp và lời nhắc đã gửi. |
| `debug` | Thêm mọi yêu cầu kèm trạng thái và thời gian, từng lần đồng bộ, lúc việc đồng bộ nhanh lên hoặc chậm đi khi mọi người mở và đóng Mitra, các phiên, các chỉnh sửa mục và các cuộc trao đổi với máy chủ CalDAV. |
| `trace` | Thêm mọi truy vấn cơ sở dữ liệu và dữ liệu lịch thô. Có rất nhiều. |

Mitra ghi lại mức nó đang chạy khi khởi động.

> [!NOTE]
> Mật khẩu, mã thông báo và các bí mật khác không bao giờ được ghi lại, ở bất kỳ mức nào. `debug` và `trace` vẫn có thể hiện tiêu đề mục và dữ liệu lịch, nên hãy xem qua nhật ký trước khi chia sẻ.

## Dùng mức nào

- Khi một lịch không đồng bộ, `debug` hiện từng lần đồng bộ và các yêu cầu đến CalDAV và Notion.
- Khi lời nhắc không đến, `info` đã ghi từng lời nhắc khi nó được gửi đi, và `debug` thêm từng lần thử gửi và các thiết bị đã bị loại.
- Khi bạn thấy trang lỗi, `error` có nó kèm stack trace, và `info` mặc định đã bao gồm nó.
- Khi bạn cần thấy chính xác những gì nhà cung cấp đã gửi, `trace` thêm dữ liệu thô và các truy vấn cơ sở dữ liệu. Chỉ nên bật trong thời gian ngắn.
