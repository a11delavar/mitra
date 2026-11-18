---
title: Lịch đăng ký
description: Đăng ký một liên kết lịch đã công bố, chẳng hạn địa chỉ webcal:// hoặc nguồn cấp .ics, và xem các mục của nó trong Mitra, ở chế độ chỉ đọc.
---

Nhiều lịch được công bố chứ không phải chia sẻ: ngày lễ, lịch thi đấu thể thao, các kỳ học, nguồn cấp từ một công cụ ở chỗ làm, hoặc địa chỉ riêng của lịch Google hay Outlook của chính bạn. Bạn không đăng nhập vào những lịch này. Bạn đăng ký chúng bằng một liên kết.

Một **lịch đăng ký** đưa một liên kết như vậy vào Mitra thành một lịch riêng, với các sự kiện của nó, và cả công việc nếu có.

Lịch đăng ký là chỉ đọc. Nguồn cấp nằm trên máy chủ khác, nơi không nhận thay đổi, nên Mitra hiển thị những gì nó công bố và không bao giờ ghi ngược lại. Bạn vẫn có thể đổi tên, đổi màu, sắp xếp lại và ẩn lịch; xem [Lịch chỉ đọc](../calendars.md#read-only-calendars). Để giữ một bản sao các mục mà bạn có thể sửa, dùng **Sao chép các mục đến…** trong menu **⋯** của lịch.

## Đăng ký một lịch

1. Chọn **Thêm tích hợp** ở cuối thanh bên, rồi **Lịch đăng ký**.
2. Dán liên kết vào **URL lịch**. Đó là địa chỉ `webcal://`, như các nút “Subscribe” thường cho bạn, hoặc địa chỉ `https://`, thường kết thúc bằng `.ics`.
3. Để trống **Tên người dùng (không bắt buộc)** và **Mật khẩu (không bắt buộc)**, trừ khi nguồn cấp yêu cầu (xem [nguồn cấp có mật khẩu](#feeds-with-a-password)).
4. Nhấn **Kết nối**. Mitra đọc nguồn cấp và liệt kê lịch của nó.
5. Để nó bật và nhấn **Lưu**.

Một liên kết là một lịch. Để đăng ký nhiều lịch, hãy thêm một lịch đăng ký cho mỗi liên kết.

Lịch lấy tên từ nguồn cấp, và màu cũng vậy nếu nguồn cấp có. Bạn có thể đổi tên nó trên thanh bên, và tên của bạn được giữ cho đến khi chính nguồn cấp đổi tên lịch.

Nếu bạn đã [đặt Mitra làm ứng dụng lịch mặc định](../calendar-files.md), nhấp vào một liên kết `webcal://` trên trang web sẽ mở biểu mẫu này với liên kết đã điền sẵn.

### Tìm liên kết lịch ở đâu

| Nhà cung cấp | Tìm ở đâu |
| --- | --- |
| Google Lịch | Trong cài đặt của lịch, **Tích hợp lịch** → **Địa chỉ bí mật ở định dạng iCal** |
| Outlook và Microsoft 365 | **Chia sẻ** → **Xuất bản lịch**, rồi sao chép liên kết ICS |
| iCloud | Nhấp chuột phải vào lịch → **Chia sẻ lịch** → **Lịch công khai** |
| Nextcloud | Menu **⋯** của lịch → **Sao chép liên kết đăng ký** |
| Lịch công khai | Hầu hết các trang web ngày lễ, thể thao và trường học đều có liên kết `.ics` |

> [!CAUTION]
> Địa chỉ bí mật là một mật khẩu dưới dạng liên kết: ai có nó đều đọc được lịch. Hãy giữ kín, và đặt lại trong cài đặt của nhà cung cấp nếu nó bị lộ.

### Nguồn cấp có mật khẩu

Hầu hết các nguồn cấp đã công bố mang khóa truy cập ngay trong liên kết và không cần gì thêm. Nếu một nguồn cấp, chẳng hạn trên máy chủ của công ty hoặc máy chủ tự lưu trữ, yêu cầu tên người dùng và mật khẩu (xác thực HTTP Basic), hãy nhập chúng khi đăng ký. Mitra giữ mật khẩu trên máy chủ và không bao giờ gửi lại cho trình duyệt của bạn.

## Cách lịch được cập nhật

Mitra đồng bộ mỗi lịch đăng ký 15 phút một lần, dù có ai mở Mitra hay không, nên mở Mitra không làm nguồn cấp được tải sớm hơn (xem [cách đồng bộ hoạt động](README.md#how-syncing-works)). Một lần đồng bộ tốn rất ít: Mitra hỏi máy chủ của nguồn cấp xem có gì thay đổi không, và chỉ tải lịch về khi có.

Lịch phản chiếu nguồn cấp. Các mục thêm vào nguồn cấp sẽ xuất hiện trong Mitra, và các mục bị xóa khỏi đó sẽ biến mất.

Nếu lịch trông có vẻ sai, **Nhập lại các mục** trong menu **⋯** của nó sẽ đọc lại nguồn cấp từ đầu. Bản thân nguồn cấp không bao giờ bị động đến. Xem [Nhập lại một lịch](../calendars.md#re-import-a-calendar).

## Khắc phục sự cố

- Nếu Mitra báo “The calendar requires a username and password”, nguồn cấp được bảo vệ. Hãy nhập tên người dùng và mật khẩu cần thiết.
- Nếu Mitra báo “No calendar was found at that address”, hãy kiểm tra lỗi gõ trong liên kết. Địa chỉ bí mật cũng ngừng hoạt động khi chủ sở hữu đặt lại nó.
- Nếu Mitra báo “The address did not return a calendar”, liên kết dẫn đến một trang web chứ không phải nguồn cấp. Hãy tìm liên kết có nhãn iCal, ICS hoặc Subscribe.
- Nếu Mitra báo “The calendar is too large to subscribe to”, nguồn cấp lớn hơn 20 MB, mức Mitra không đọc.
