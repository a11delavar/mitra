---
title: Cập nhật
description: Cách Mitra báo cho bạn về các phiên bản mới, việc kiểm tra đó gửi gì, cách tắt nó, và cách cập nhật.
---

Mitra cho bạn biết khi có phiên bản mới hơn phiên bản bạn đang chạy. Nó không bao giờ tự cập nhật: việc kéo phiên bản mới về là do bạn.

## Chỉ báo cập nhật

Khi có bản mới hơn, một chấm nhỏ xuất hiện trên logo ở thanh bên. Nhấp vào tên phiên bản của bạn để mở **Giới thiệu**, nơi hiện phiên bản và commit bạn đang chạy cùng các liên kết đến nội dung mới. **Sao chép** ở đó sao chép thông tin phiên bản, thứ mà một báo cáo lỗi cần.

**Có gì mới**, trong [bảng lệnh](shortcuts.md#command-palette), liệt kê các thay đổi của mọi phiên bản. Sau khi máy chủ của bạn được cập nhật, Mitra yêu cầu bạn **Tải lại để hoàn tất cập nhật** ở mọi thẻ đã mở từ trước.

Nếu bạn chạy một bản phát hành (`latest`, `0.6` hoặc một phiên bản chính xác), nó chỉ cho bạn bản phát hành mới nhất. Nếu bạn chạy image `dev`, nó chỉ đến các commit mới nhất trên `main` và cho biết chúng đi trước bao xa.

## Việc kiểm tra gửi gì

Máy chủ, không bao giờ là trình duyệt của bạn, hỏi GitHub vài lần mỗi ngày xem có gì mới hơn không. Yêu cầu không mang thông tin nào về phiên bản của bạn ngoài những gì mọi yêu cầu đều có: địa chỉ IP của bạn, và phiên bản đang chạy trong user agent. Không có telemetry, không có mã định danh, không có số đếm.

Nếu máy chủ không kết nối được GitHub, nó ghi nhật ký một lần rồi im lặng sau đó.

Để tắt hoàn toàn việc kiểm tra, đặt `MITRA_UPDATE_CHECK` thành `off` (`false`, `0` và `no` cũng được):

```yaml
environment:
  MITRA_UPDATE_CHECK: 'off'
```

## Chọn một tag image

Tag quyết định bạn chuyển sang phiên bản mới nhanh đến mức nào.

| Tag | Bạn nhận được gì |
| --- | --- |
| `latest` | Bản phát hành mới nhất. |
| `0.6` | Bản phát hành `0.6.x` mới nhất: có bản sửa lỗi, nhưng không có phiên bản phụ mới. |
| `0.6.0` | Chính xác phiên bản đó. |
| `dev` | Commit mới nhất trên `main`, để thử nghiệm trước khi phát hành. |

Cho đến 1.0, một phiên bản phụ mới (0.6 lên 0.7) có thể thay đổi những thứ bạn đang dựa vào. Nếu bạn muốn tự chọn lúc đó xảy ra, hãy dùng `0.6` và chuyển tiếp khi bạn sẵn sàng. Tất cả các tag được liệt kê trên [GitHub](https://github.com/a11delavar/mitra/pkgs/container/mitra).

## Cập nhật Mitra

Kéo image mới về và tạo lại container:

```bash
docker compose pull
docker compose up -d
```

Dữ liệu của bạn nằm trong thư mục được gắn vào, nên nó vẫn còn. Nếu phiên bản mới thay đổi cơ sở dữ liệu, Mitra cập nhật nó khi khởi động, và bạn không bao giờ phải tự động tay vào. Các công cụ như [Watchtower](https://containrrr.dev/watchtower/) có thể làm việc này cho bạn theo lịch.

Bạn nhận được phiên bản nào tùy thuộc vào [tag image](#choose-an-image-tag) của bạn. Trước khi chuyển sang một phiên bản phụ mới, bạn nên đọc [ghi chú phát hành](https://github.com/a11delavar/mitra/releases).
