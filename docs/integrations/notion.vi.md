---
title: Notion
description: Đưa các chế độ xem của cơ sở dữ liệu công việc trong Notion vào Mitra dưới dạng các lịch công việc đồng bộ hai chiều.
---

Mitra kết nối với Notion để lấy công việc. Mỗi chế độ xem của một cơ sở dữ liệu công việc, như “All tasks”, “My tasks” hoặc bảng sprint, trở thành một lịch trong Mitra chứa đúng những công việc mà chế độ xem đó hiển thị: Notion áp dụng các bộ lọc của chế độ xem, còn Mitra đặt kết quả lên lịch của bạn. Tiêu đề, trạng thái, ngày và mô tả của công việc được đồng bộ hai chiều.

Bạn kết nối từ ứng dụng bằng một mã tích hợp. Không cần thiết lập gì trên máy chủ.

## Kết nối một workspace

1. Tạo một tích hợp tại [notion.so/profile/integrations](https://www.notion.so/profile/integrations). Tích hợp nội bộ là đủ.
2. Chia sẻ các cơ sở dữ liệu công việc của bạn với nó. Mở từng cơ sở dữ liệu trong Notion, chọn **•••** → **Connections**, rồi thêm tích hợp của bạn.
3. Trong Mitra, chọn **Thêm tích hợp** ở cuối thanh bên, rồi chọn **Notion**, và dán mã bí mật của tích hợp, bắt đầu bằng `ntn_`, vào **Mã tích hợp**.
4. Nhấn **Kết nối**. Mitra liệt kê các chế độ xem của những cơ sở dữ liệu bạn đã chia sẻ, đặt tên theo cơ sở dữ liệu và chế độ xem.
5. Chọn các chế độ xem bạn muốn, rồi nhấn **Lưu**.

Ban đầu, Mitra bật một chế độ xem cho mỗi cơ sở dữ liệu. Một công việc thuộc về mọi chế độ xem có bộ lọc khớp với nó, nên nếu bật hai chế độ xem của cùng một cơ sở dữ liệu, công việc đó sẽ hiện hai lần. Bạn vẫn có thể chủ động bật thêm.

Mitra cung cấp các chế độ xem dạng bảng, board, danh sách, lịch, dòng thời gian và thư viện. Các loại chế độ xem khác không được liệt kê.

## Cơ sở dữ liệu nào dùng được

Một cơ sở dữ liệu xuất hiện khi nó có một thuộc tính kiểu Status và một thuộc tính kiểu Date. Các mẫu công việc của chính Notion đều có cả hai.

Mitra đọc trạng thái của công việc từ nhóm mà trạng thái Notion của nó thuộc về:

| Nhóm trạng thái Notion | Trạng thái trong Mitra |
| --- | --- |
| To-do | Cần làm |
| In progress | Đang làm |
| Complete | Đã xong |

Khi bạn đổi trạng thái trong Mitra, Notion nhận tùy chọn đầu tiên của nhóm tương ứng.

Thuộc tính Date là nơi Mitra đặt công việc, nên nó chính là lịch trình của công việc. Nếu một cơ sở dữ liệu có nhiều thuộc tính Date, Mitra ưu tiên thuộc tính có tên bắt đầu bằng “Due”, sau đó là thuộc tính tên “Date”, “When”, “Deadline”, “Scheduled” hoặc “Do date”, và nếu không có thì lấy thuộc tính đầu tiên.

## Những gì được đồng bộ

Tiêu đề, trạng thái và ngày được đồng bộ hai chiều, dưới dạng ngày cả ngày hoặc có giờ. Giờ được hiển thị theo múi giờ của bạn. Công việc không có ngày sẽ chờ trong danh sách **Chưa lên lịch** của [tab Kế hoạch](../planning.md#the-planning-tab).

Mô tả của công việc là nội dung trang Notion của nó, được viết dưới dạng Markdown, bao gồm danh sách việc cần làm, callout và hình ảnh. Khi bạn sửa mô tả trong Mitra, Mitra chỉ thay thế phần mà mô tả hiển thị. Embed, trang con và synced block vẫn nằm nguyên trong Notion, và Mitra không hiển thị chúng. Hình ảnh bạn thêm trong Notion được hiển thị trong Mitra và giữ nguyên trong Notion; sau khi sửa từ Mitra, nó chuyển lên phía trên văn bản, vì Notion chỉ cho các ứng dụng khác thêm văn bản sau phần nó giữ lại.

Các thuộc tính quan hệ liên kết công việc trong cùng một cơ sở dữ liệu trở thành liên kết trong Mitra, theo cả hai chiều. Thuộc tính tên “Parent task” hoặc “Sub-tasks” tạo ra [công việc con](../subtasks.md), thuộc tính tên “Blocked by” hoặc “Depends on” tạo ra [phụ thuộc](../dependencies.md), và các quan hệ khác hiện dưới tên riêng của chúng. Quan hệ đến các cơ sở dữ liệu khác không được hiển thị.

Để mở một công việc trong Notion, chọn **Mở trong Notion** trong menu **⋯** của trình chỉnh sửa. Xóa một công việc trong Mitra sẽ chuyển trang của nó vào thùng rác của Notion, nơi bạn vẫn có thể khôi phục.

Notion giới hạn tần suất các ứng dụng được gọi nó, nên Mitra đồng bộ với Notion khoảng một lần mỗi phút (xem [cách đồng bộ hoạt động](README.md#how-syncing-works)). Một công việc mới không bao giờ biến mất tạm thời trong lúc Notion bắt kịp.

## Những gì Notion không chứa được

Một cơ sở dữ liệu Notion chứa các công việc với một ngày duy nhất, và điều đó quyết định những gì một lịch Notion có thể chứa:

- Nó chỉ chứa công việc, nên không có sự kiện và không có [thời gian khả dụng](../availability.md).
- Ngày duy nhất của công việc là lịch trình của nó, nên không có hạn chót hay ước tính.
- Công việc không thể lặp lại, và không có lời nhắc, địa điểm hay người tham gia.
- Không có trạng thái **Đã hủy**, vì Notion không có nhóm cho nó.
- Công việc không thể có múi giờ riêng, phần trăm tiến độ, bận hay rảnh, hoặc chế độ hiển thị.

Mitra ẩn các trường này trên công việc Notion, nên không có gì bạn nhập ở đó biến mất ở lần đồng bộ tiếp theo. Để chuyển các mục dùng chúng vào Notion, xem [Di chuyển hoặc sao chép mọi mục sang lịch khác](../calendars.md#move-or-copy-every-entry-to-another-calendar), phần này cho bạn thấy trước những gì sẽ không chuyển được.

## Chế độ xem và bộ lọc

Một lịch hiển thị những gì chế độ xem Notion của nó hiển thị, và một công việc bạn tạo trong đó nhận các giá trị lọc của chế độ xem, nên nó nằm đúng trong chế độ xem. Một công việc thêm vào chế độ xem “University” nhận “Area = University”, như thể bạn thêm dòng đó trong Notion.

Mitra điền các bộ lọc mà một giá trị đơn lẻ có thể thỏa mãn: select, status, multi-select, hộp kiểm, hoặc quan hệ đến một trang cụ thể. Một số bộ lọc không giá trị đơn lẻ nào khớp được, như công thức, khoảng ngày, hoặc một trong nhiều tùy chọn. Một công việc bạn tạo trong chế độ xem như vậy sẽ không khớp với nó, nên, như trong Notion, nó không hiện ở đó. Nó vẫn nằm trong cơ sở dữ liệu, và một chế độ xem có ít bộ lọc hơn, như “All tasks”, sẽ hiển thị nó.

> [!TIP]
> Nếu một chế độ xem lọc theo quan hệ đến cơ sở dữ liệu khác, chẳng hạn các công việc có “Area” trỏ đến trang “University” trong cơ sở dữ liệu “Areas”, hãy chia sẻ cả cơ sở dữ liệu đó với tích hợp của bạn. Nếu không, Mitra không thể đặt quan hệ cho các công việc mới, và chúng sẽ không xuất hiện trong chế độ xem.

## Khắc phục sự cố

- Nếu một cơ sở dữ liệu không được liệt kê, nó thiếu thuộc tính Status hoặc Date, hoặc chưa được chia sẻ với tích hợp của bạn (**•••** → **Connections** trong Notion). Sau khi chia sẻ, mở **⋯ → Sửa** của tài khoản trong Mitra và nhấn **Làm mới**.
- Nếu một công việc xuất hiện hai lần, bạn đã bật hai chế độ xem của cùng một cơ sở dữ liệu mà cả hai đều chứa nó. Hãy tắt một trong hai trong **⋯ → Sửa** của tài khoản.
