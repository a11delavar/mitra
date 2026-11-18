---
title: Lịch Mitra
description: Các lịch được lưu ngay trong Mitra, trên máy chủ của bạn, không có tài khoản nào phía sau.
---

Một lịch Mitra được lưu trong cơ sở dữ liệu riêng của Mitra thay vì ở một nhà cung cấp. Không có tài khoản để kết nối và không có gì để đồng bộ: bạn tạo một lịch và bắt đầu thêm các mục. Đây là cách đơn giản nhất để bắt đầu với Mitra, và là nơi phù hợp cho bất cứ thứ gì không thuộc về các tài khoản sẵn có của bạn.

Các lịch Mitra nằm trên máy chủ của bạn, không phải trên thiết bị, nên chúng có mặt ở bất cứ nơi nào bạn mở Mitra. Chúng có thể chứa mọi thứ Mitra có thể: sự kiện và công việc, lặp lại, lời nhắc, [thời gian khả dụng](../availability.md), [công việc con](../subtasks.md), [phụ thuộc](../dependencies.md), hạn chót và ước tính.

## Thêm lịch Mitra

1. Chọn **Thêm tích hợp** ở cuối thanh bên, rồi **Mitra**.
2. Đặt tên cho lịch đầu tiên của bạn.
3. Nhấn **Lưu**.

Lịch sẵn sàng ngay. Bạn chỉ thêm tích hợp này một lần: nó chứa bao nhiêu lịch tùy thích, nên ô của nó sẽ biến mất khỏi **Thêm tích hợp** sau đó.

Để thêm một lịch khác, mở menu **⋯** trên tiêu đề Mitra ở thanh bên và chọn **Lịch mới**. Để xóa một lịch, chọn **Xóa lịch** từ menu **⋯** của lịch đó. Đổi tên, đổi màu, sắp xếp lại và ẩn hoạt động như với bất kỳ lịch nào; xem [Lịch](../calendars.md).

> [!CAUTION]
> Xóa một lịch Mitra sẽ xóa vĩnh viễn mọi mục của nó, vì không có nhà cung cấp nào để lấy lại. Mitra hỏi trước, và đề nghị [di chuyển các mục](../calendars.md#move-or-copy-every-entry-to-another-calendar) sang lịch khác trước khi xóa bất cứ thứ gì.

## Di chuyển các mục vào và ra

Các mục di chuyển giữa một lịch Mitra và bất kỳ lịch nào khác. Để di chuyển một mục, chọn lịch khác trong trình chỉnh sửa của nó. Để di chuyển cả một lịch, dùng **⋯ → Di chuyển các mục đến…**, phần này cho bạn thấy trước những gì đích đến không lưu được.

Cách này cũng dùng được theo chiều ngược lại: bạn có thể bắt đầu trong Mitra và chuyển mọi thứ sang lịch CalDAV hoặc Google sau.

## Sao lưu

Một tài khoản đã kết nối giữ bản sao riêng các mục của bạn. Lịch Mitra thì không: các mục của nó chỉ tồn tại trong cơ sở dữ liệu của Mitra. Hãy bảo đảm thư mục dữ liệu của Mitra nằm trong [các bản sao lưu](../backups.md) của bạn.

Nếu bạn định bật [đăng nhập](../sso.md) sau này, hãy biết rằng nó bắt đầu mọi người với một tài khoản mới, trống. Các lịch Mitra bạn đã tạo trước đó vẫn thuộc về tài khoản một người dùng cũ.

## Những gì chúng không làm được

- Người tham gia được giữ như một bản ghi về những ai có liên quan, nhưng không ai nhận được lời mời và không có phản hồi nào gửi về, vì không có máy chủ lịch để gửi chúng. Nếu bạn chuyển một cuộc họp vào đây từ một lịch CalDAV, bản gốc bị xóa ở đó, và một số máy chủ sẽ báo cho người tham gia rằng nó đã bị hủy. Hãy sao chép thay vì chuyển nếu họ không nên biết.
- Các ứng dụng khác không thấy được chúng. Mitra không công bố các lịch của mình qua CalDAV, nên hãy dùng máy chủ [CalDAV](caldav.md) cho những lịch bạn cũng muốn có trong ứng dụng lịch trên điện thoại.
- Không có gì để nhập lại, nên **Nhập lại các mục** không được cung cấp.
