---
title: Lịch Apple
description: Kết nối các lịch iCloud của bạn với Mitra bằng mật khẩu dành riêng cho ứng dụng, không cần thiết lập gì trên máy chủ.
---

Mitra kết nối với các lịch iCloud của bạn qua CalDAV và đồng bộ các sự kiện của chúng theo cả hai chiều. Apple không cho ứng dụng khác đăng nhập bằng mật khẩu Apple của bạn, nên trước tiên bạn tạo một mật khẩu dành riêng cho ứng dụng cho Mitra. Chỉ mất một phút, và không có gì cần thiết lập trên máy chủ.

## Tạo mật khẩu dành riêng cho ứng dụng

1. Đăng nhập tại [appleid.apple.com](https://appleid.apple.com/).
2. Trong **Sign-In and Security**, chọn **App-Specific Passwords**.
3. Tạo một mật khẩu mới, đặt tên là “Mitra” để bạn nhận ra nó sau này, và sao chép nó.

Apple chỉ cung cấp mật khẩu dành riêng cho ứng dụng khi tài khoản của bạn đã bật xác thực hai yếu tố.

## Kết nối tài khoản của bạn

1. Chọn **Thêm tích hợp** ở cuối thanh bên, rồi **Lịch Apple**.
2. Nhập **ID Apple** của bạn, tức địa chỉ email bạn dùng để đăng nhập Apple, và **Mật khẩu dành riêng cho ứng dụng** bạn đã tạo cho Mitra.
3. Nhấn **Kết nối**. Mitra liệt kê các lịch iCloud của bạn, tất cả đều bật.
4. Tắt những lịch bạn không muốn, rồi nhấn **Lưu**.

Mitra nhập các lịch bạn giữ lại và đồng bộ chúng mỗi 10 giây khi bạn đang mở nó (xem [cách đồng bộ hoạt động](README.md#how-syncing-works)).

## Những gì được đồng bộ

Các sự kiện đồng bộ theo cả hai chiều, cùng mọi thứ mà [CalDAV](caldav.md#what-syncs) mang theo.

> [!NOTE]
> Công việc thì khác. Các công việc Mitra lưu vào một lịch iCloud được lưu trong iCloud, và các ứng dụng CalDAV khác đọc được chúng, nhưng ứng dụng Lời nhắc của Apple không hiển thị chúng. Lời nhắc đã ngừng dùng CalDAV từ iOS 13, và Apple không cho các ứng dụng như Mitra con đường nào khác.

[Thời gian khả dụng](../availability.md) bạn đánh dấu là bận trong một lịch iCloud được thêm vào lịch đó dưới dạng các sự kiện bận, nên khoảng thời gian đó hiển thị là đã kín trên iPhone của bạn và với bất kỳ ai mời bạn. Nó hoạt động như mô tả cho [CalDAV](caldav.md#busy-availability).

## Ngắt kết nối tài khoản

Chọn **Xóa** trong menu **⋯** của tài khoản ở thanh bên để gỡ nó khỏi Mitra. Để thu hồi quyền truy cập của Mitra ở phía Apple, hãy xóa mật khẩu “Mitra” trên trang **Sign-In and Security** nơi bạn đã tạo nó. Mật khẩu Apple và các ứng dụng khác của bạn không bị ảnh hưởng.

## Khắc phục sự cố

- Nếu kết nối thất bại vì mật khẩu, hãy kiểm tra xem bạn đã nhập mật khẩu dành riêng cho ứng dụng, không phải mật khẩu Apple.
- Nếu thiếu một lịch, tức là nó đang tắt. Hãy bật nó trong **⋯ → Sửa** của tài khoản và nhấn **Lưu**.
