---
title: Todoist
description: Đưa các dự án Todoist của bạn vào Mitra dưới dạng các lịch công việc đồng bộ theo cả hai chiều.
---

Mitra kết nối với Todoist để lấy công việc. Mỗi dự án Todoist của bạn trở thành một lịch trong Mitra chứa các công việc của nó. Tiêu đề, mô tả, ngày và trạng thái hoàn thành của một công việc được đồng bộ theo cả hai chiều.

Bạn kết nối từ ứng dụng bằng mã API của mình. Không có gì cần thiết lập trên máy chủ.

## Kết nối một tài khoản

1. Trong Todoist, mở **Cài đặt** → **Tích hợp** → **Nhà phát triển** và sao chép mã API của bạn.
2. Trong Mitra, chọn **Thêm tích hợp** ở cuối thanh bên, rồi **Todoist**, và dán mã vào **Mã API Todoist**.
3. Nhấn **Kết nối**. Mitra liệt kê các dự án của bạn, mỗi dự án có màu của nó từ Todoist. Một dự án nằm trong dự án khác được đặt tên theo cả hai, chẳng hạn “Work · Launch”.
4. Chọn các dự án bạn muốn, rồi nhấn **Lưu**.

Bạn có thể kết nối nhiều tài khoản Todoist. Các dự án đã lưu trữ không được liệt kê.

## Những gì được đồng bộ

Tiêu đề, mô tả và trạng thái hoàn thành được đồng bộ theo cả hai chiều, các ngày cũng vậy:

| Trong Todoist | Trong Mitra |
| --- | --- |
| Ngày | Lịch của công việc: một ngày, hoặc một thời điểm |
| Thời lượng | Thời gian công việc được lên lịch, hoặc [ước tính](../planning.md#set-an-estimate) của nó khi chưa có ngày |
| Hạn chót | [Hạn chót](../planning.md#set-a-due-date) của nó |
| Công việc con | Một [công việc con](../subtasks.md) |

Một công việc không có ngày sẽ nằm chờ trong danh sách **Chưa lên lịch** của [tab Kế hoạch](../planning.md#the-planning-tab). Các công việc bạn đã hoàn thành trong mười hai tuần qua được đưa vào khi bạn kết nối, và mọi lần hoàn thành sau đó.

Todoist giữ một thời điểm theo hai kiểu: thời gian trôi nổi, giống nhau trên mọi đồng hồ dù bạn ở đâu, hoặc cố định theo một múi giờ. Mitra giữ cả hai như vốn có: thời gian trôi nổi vẫn là [cùng một giờ ở mọi nơi](../time-zones.md#same-time-everywhere), và thời gian cố định giữ nguyên múi giờ của nó.

Hạn chót và thời lượng nằm trong các gói Pro và Business của Todoist. Với tài khoản miễn phí, các công việc Todoist không có hạn chót, giờ kết thúc hay ước tính trong Mitra: một công việc có giờ là một thời điểm, và một công việc theo ngày chỉ chiếm riêng ngày đó. Khi gói của bạn thay đổi, chẳng hạn khi bản dùng thử bắt đầu hoặc kết thúc, Mitra đọc lại mọi công việc. Hạn chót là một ngày, nên hạn chót bạn gán giờ trong Mitra chỉ giữ lại phần ngày.

Mitra không hiển thị mức ưu tiên, nhãn, phần, bình luận hay lời nhắc của một công việc, và để chúng nguyên như trong Todoist. Di chuyển một công việc sang lịch Todoist khác sẽ chuyển nó sang dự án đó, và giữ lại tất cả những thứ này.

Để mở một công việc trong Todoist, chọn **Mở trong Todoist** trong menu **⋯** của trình chỉnh sửa. Xóa một công việc trong Mitra cũng xóa nó trong Todoist.

Todoist giới hạn tần suất các ứng dụng được gọi đến, nên Mitra đồng bộ nó khoảng một lần mỗi phút (xem [cách đồng bộ hoạt động](README.md#how-syncing-works)).

## Công việc lặp lại

Một công việc lặp lại trong Todoist hiển thị ở ngày kế tiếp của nó, như Todoist lưu giữ, mà không có quy tắc. Hoàn thành nó trong Mitra sẽ hoàn thành nó trong Todoist, và Todoist chuyển nó sang ngày sau đó, như vẫn luôn làm. Di chuyển nó sang ngày khác chỉ đổi ngày kế tiếp, còn quy tắc của nó giữ nguyên. Để đổi chính quy tắc, hãy sửa công việc trong Todoist.

## Những gì chỉ ở trong Mitra

Todoist không có phụ thuộc, nên các [phụ thuộc](../dependencies.md) giữa các công việc Todoist chỉ được giữ trong Mitra. Chúng sẽ mất nếu bạn ngắt kết nối tài khoản hoặc [nhập lại một lịch](../calendars.md#re-import-a-calendar). Công việc cha của một công việc con được giữ ở cả hai nơi, miễn là công việc cha là một công việc của cùng tài khoản Todoist. Khi đó Todoist chuyển công việc con vào dự án của công việc cha.

## Những gì Todoist không lưu được

- Nó chỉ lưu công việc, nên không có sự kiện và không có [thời gian khả dụng](../availability.md).
- Một công việc chỉ có mở hoặc xong, nên không có trạng thái **Đang làm** hay **Đã hủy**. Một công việc đang làm ở nơi khác sẽ quay về **Cần làm** khi bạn chuyển nó vào Todoist.
- Bạn không thể làm một công việc lặp lại từ Mitra.
- Trong Mitra, một công việc không có lời nhắc, địa điểm, người tham gia, tệp đính kèm, tiến độ, bận hoặc rảnh, hay chế độ hiển thị.

Mitra ẩn các trường này trên công việc Todoist, nên không có gì bạn nhập ở đó bị mất ở lần đồng bộ tiếp theo. Để chuyển các mục dùng chúng vào Todoist, xem [Di chuyển hoặc sao chép mọi mục sang lịch khác](../calendars.md#move-or-copy-every-entry-to-another-calendar), phần này cho bạn thấy trước những gì sẽ không chuyển được.

## Khắc phục sự cố

- Nếu Mitra báo Todoist từ chối mã API, hãy sao chép lại từ **Cài đặt** → **Tích hợp** → **Nhà phát triển**. Nếu bạn đã đặt lại mã trong Todoist, mở **⋯ → Sửa** của tài khoản trong Mitra và dán mã mới.
- Nếu thiếu một dự án, có thể nó đã được lưu trữ. Sau khi bỏ lưu trữ trong Todoist, mở **⋯ → Sửa** của tài khoản trong Mitra và nhấn **Làm mới**.
