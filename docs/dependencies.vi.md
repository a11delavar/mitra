---
title: Phụ thuộc
description: "Cho một mục chờ mục khác, xem thứ tự dưới dạng đường nối trên lịch, và di chuyển cả chuỗi cùng nhau."
---

Một **phụ thuộc** cho biết một mục không thể bắt đầu cho đến khi mục khác kết thúc: bản nháp trước bản duyệt, bản duyệt trước bản phát hành. Mục phải chờ là mục bị mục kia chặn.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/week-detail-dark.webp">
  <img src="../assets/screenshots/week-detail-light.webp" alt="Một tuần có ba công việc học tập nối với nhau bằng các đường, mỗi công việc dẫn đến công việc kế tiếp và đến kỳ thi" />
</picture>

## Thêm phụ thuộc

Mở mục phải chờ, nhấn **＋** ở **Bị chặn bởi** và nhập một phần tiêu đề của mục phải kết thúc trước. Tìm kiếm bao gồm mọi lịch của bạn, kể cả lịch bị ẩn, nên một mục có thể chờ mục ở lịch hoặc tài khoản khác. Các mục trong lịch bị ẩn hiện mờ. Mục kia sau đó liệt kê mục này dưới **Chặn**, nơi chỉ liệt kê các liên kết: bạn luôn thêm liên kết từ mục phải chờ.

Trong trình chỉnh sửa, nhấp vào tiêu đề của một mục được liên kết để mở nó, hoặc nhấn **✕** bên cạnh để xóa liên kết, từ phía nào cũng được. Mitra từ chối liên kết tạo thành vòng tròn, chẳng hạn hai mục chờ lẫn nhau.

Với chuột, bạn cũng có thể vẽ phụ thuộc trong chế độ xem tuần hoặc tháng. Trỏ vào mục đi trước, nắm lấy đường ngắn ở cuối mục, rồi thả lên mục cần chờ nó. Khi bạn kéo, đường chuyển sang màu đỏ khi ở trên một mục đã bắt đầu quá sớm.

## Đường nối trên lịch

Chế độ xem tuần, chế độ xem tháng và dòng thời gian vẽ một đường từ cuối mỗi mục đến đầu mục chờ nó. Trỏ vào một mục để đưa các đường của nó lên trước. Có thể tắt đường nối của từng chế độ xem trong **Cài đặt → Lịch**, bằng **Đường nối trong chế độ xem tuần**, **Đường nối trong chế độ xem tháng** và **Đường nối trong dòng thời gian**.

## Phụ thuộc bị phá vỡ

Khi một mục bắt đầu trước khi mục nó chờ kết thúc, phụ thuộc bị phá vỡ. Đường của nó trên lịch chuyển sang màu đỏ, và trong các hàng **Bị chặn bởi** và **Chặn** của trình chỉnh sửa, mục ở phía bên kia được ghi tên màu đỏ. Hãy đưa một trong hai mục về đúng thứ tự, và cảnh báo sẽ biến mất.

## Di chuyển một chuỗi

Khi bạn kéo một mục, hoặc một cạnh của mục, và các mục khác phụ thuộc vào nó, Mitra hỏi **Di chuyển cả các mục phụ thuộc?**. Các lựa chọn di chuyển mục khác cho biết số lượng:

- **Chỉ mục này** di chuyển mục này và để nguyên phần còn lại.
- **Giữ nguyên chuỗi phụ thuộc** chỉ di chuyển các mục khác vừa đủ để giữ đúng thứ tự. Các mục sau mục này dời muộn hơn, và nếu bạn dời mục này sớm hơn, các mục trước nó dời sớm hơn. Mục nào còn đủ chỗ trống thì giữ nguyên vị trí.
- **Dời tất cả cùng một khoảng** di chuyển cả chuỗi, trước và sau mục này, đi cùng một khoảng thời gian, nên khoảng cách giữa chúng không đổi.

Mitra chỉ hỏi khi các lựa chọn cho kết quả khác nhau. Việc đổi giờ trong trình chỉnh sửa không bao giờ di chuyển mục khác.

Khi một mục di chuyển như một phần của chuỗi, các công việc con của nó di chuyển theo. Các mục lặp lại và công việc chưa lên lịch trong chuỗi không bao giờ bị di chuyển.

> [!TIP]
> Giữ <kbd>Ctrl</kbd> (<kbd>⌘</kbd> trên Mac) khi thả để bỏ qua câu hỏi và chỉ di chuyển mục đó. Xem [phím tắt](shortcuts.md).

## Những lịch nào hỗ trợ

Một liên kết được lưu cùng mục phải chờ, trong chính lịch của mục đó. [Máy chủ lịch](integrations/caldav.md), [Lịch Apple](integrations/apple.md) và [lịch Mitra](integrations/mitra.md) chứa được mọi liên kết, và trên máy chủ lịch, liên kết được ghi theo định dạng lịch chuẩn, nên các ứng dụng khác dùng cùng lịch đọc được.

- Trong [Notion](integrations/notion.md), liên kết đến một công việc trong cùng cơ sở dữ liệu được ghi vào thuộc tính quan hệ tương ứng, chẳng hạn “Blocked by”. Mitra tự giữ các liên kết đến bất cứ thứ gì khác.
- [Todoist](integrations/todoist.md) không có phụ thuộc, nên Mitra tự giữ chúng. Chúng sẽ mất nếu bạn ngắt kết nối tài khoản hoặc nhập lại lịch.
- [Google Lịch](integrations/google.md) loại bỏ liên kết, nên một mục trong lịch Google không thể được gán thứ gì để chờ. Các mục ở lịch khác vẫn liên kết đến nó được.
- [Lịch đăng ký](integrations/subscriptions.md) là chỉ đọc, và [Tempo](integrations/tempo.md) không có liên kết.
