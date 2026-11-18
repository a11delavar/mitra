---
title: Các mục
description: "Mở trình chỉnh sửa mục và xem mọi thứ một sự kiện hay công việc có thể chứa: lịch, loại, màu, trạng thái, mô tả và nhiều thứ khác."
---

Mọi thứ trên lịch của bạn đều là một **mục**. Hầu hết các mục là **sự kiện**, diễn ra vào một thời điểm, hoặc **công việc**, những việc bạn làm xong rồi đánh dấu hoàn thành. Loại thứ ba, [thời gian khả dụng](availability.md), tô bóng khoảng thời gian bạn dành cho một việc gì đó, nằm phía sau các sự kiện và công việc.

Trang này nói về trình chỉnh sửa mục: phần đầu, các hàng bên dưới và phần mô tả.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/screenshots/due-detail-dark.webp">
  <img src="../assets/screenshots/due-detail-light.webp" alt="Trình chỉnh sửa của một công việc trong lịch Work, với ô trạng thái và tiêu đề, ngày bắt đầu, kết thúc và hạn chót, một liên kết và phần mô tả, chế độ hiển thị, lời nhắc và các quan hệ" />
</picture>

## Mở trình chỉnh sửa

Nhấp vào một mục để mở trình chỉnh sửa bên cạnh nó. Để tạo mục mới, nhấn <kbd>C</kbd> hoặc **Tạo** ở đầu trang. Mục mới bắt đầu vào giờ tròn kế tiếp, kéo dài một giờ và được đưa vào [lịch mặc định](calendars.md#where-new-entries-land) của bạn. Trong [chế độ xem tuần](views/week.md), bạn cũng có thể kéo qua khoảng thời gian trống.

Mọi thay đổi được lưu ngay khi bạn thực hiện. Đóng trình chỉnh sửa bằng nút **✕**, hoặc bằng cách nhấp ra ngoài. Trên màn hình hẹp, chẳng hạn điện thoại, trình chỉnh sửa trượt lên từ cạnh dưới như một bảng.

## Phần đầu

Dòng trên cùng của trình chỉnh sửa chứa màu của mục, lịch, loại và menu **⋯**.

### Đặt màu riêng cho một mục

Một mục mang màu của lịch chứa nó. Để đặt cho một mục màu riêng, hãy nhấp vào chấm ở đầu phần đầu và chọn một màu. **Đặt lại về màu của lịch**, trong cùng bộ chọn đó, trả lại màu của lịch cho mục.

### Chuyển một mục sang lịch khác

Cạnh chấm màu là tên lịch của mục. Nhấp vào đó và chọn một lịch khác để chuyển mục sang. Danh sách bỏ qua những lịch không thể giữ lại thứ mà mục đang có, chẳng hạn một lần lặp lại hoặc trạng thái **Đã hủy**. Xem [Chuyển một mục](calendars.md#move-a-single-entry).

### Đổi loại của một mục

Xa hơn một chút, phần đầu hiển thị loại của mục: **Sự kiện**, **Công việc** hoặc **Thời gian khả dụng**. Nhấp vào đó và chọn loại khác. Máy chủ lịch tách riêng sự kiện và công việc, nên Mitra lưu mục thành loại kia như một mục mới và xóa mục cũ. Trình chỉnh sửa vẫn mở trên kết quả.

Những gì loại mới không thể chứa sẽ bị bỏ. Một công việc thành sự kiện sẽ mất trạng thái, tiến độ, hạn chót và ước tính. Một sự kiện thành công việc sẽ mất trạng thái bận hoặc rảnh. Thời gian khả dụng không có người tham gia hay lời nhắc.

Không thể đổi loại của mục lặp lại, hoặc trong lịch chỉ chứa một loại, chẳng hạn lịch Notion. **Thời gian khả dụng** chỉ được đưa ra ở nơi lịch có thể chứa nó.

### Menu ⋯

**Nhân bản** tạo một bản sao trong cùng lịch và mở nó ra. Giữ <kbd>Alt</kbd> khi kéo một mục sẽ tạo bản sao tại nơi bạn thả.

**Nhân bản sang ngày khác…** đặt một bản sao lên nhiều ngày cùng lúc, cho những việc rơi vào các ngày mà không kiểu lặp lại nào gọi tên được, chẳng hạn ngày 1, 3 và 17. Nhấp vào từng ngày bạn muốn trên lịch hiển thị, rồi nhấp **Nhân bản sang 3 ngày**. Mỗi bản sao giữ giờ trong ngày của mục và là một mục riêng. Để chọn một dải ngày, giữ <kbd>Shift</kbd> khi nhấp vào ngày cuối. Những ngày mục đã chiếm có một chấm và không thể chọn.

**Xóa** xóa mục. Khi trình chỉnh sửa đang mở, <kbd>Delete</kbd> hoặc <kbd>Backspace</kbd> cũng làm được việc đó, miễn là bạn không đang gõ trong một ô. Nếu mục lặp lại hoặc có công việc con, Mitra sẽ hỏi bạn muốn xóa những mục nào.

Một mục từ Notion, Todoist hoặc Tempo còn có **Mở trong Notion**, **Mở trong Todoist** hoặc **Mở trong Jira**, để mở nó ở nơi nó đến từ đó.

## Tiêu đề và thời gian

Tiêu đề là dòng lớn bên dưới phần đầu. Các hàng bên dưới cho biết mục diễn ra khi nào: ngày bắt đầu, ngày kết thúc, múi giờ và việc nó có lặp lại hay không. Để chuyển giữa ngày và giờ, nhấn **Cả ngày** ở cuối một ngày, nút này hiện khi bạn đang ở hàng đó.

Một công việc còn có hạn chót và, khi chưa lên lịch, một ước tính. Xem [Kế hoạch](planning.md). Về múi giờ, xem [Múi giờ](time-zones.md), và về lặp lại, xem [Lặp lại](repeats.md).

## Trạng thái công việc

Một công việc có ô đánh dấu trước tiêu đề và một trong bốn trạng thái: **Cần làm**, **Đang làm**, **Xong** hoặc **Đã hủy**. Nhấp vào ô đánh dấu để đánh dấu công việc đã xong, và nhấp lần nữa để mở lại. Để chọn một trạng thái bất kỳ, nhấp chuột phải vào ô đánh dấu hoặc <kbd>Alt</kbd>-nhấp vào nó. Cách này cũng dùng được ngay trên lịch.

Công việc đã xong và đã hủy bị gạch ngang. Một lịch không có trạng thái đã hủy, như Notion, sẽ bỏ **Đã hủy** khỏi menu. Công việc có công việc con hoặc danh sách kiểm hiển thị tiến độ trong ô đánh dấu; xem [Công việc con](subtasks.md#progress).

## Trạng thái sự kiện

Một sự kiện có biểu tượng trạng thái trước tiêu đề, trong trình chỉnh sửa và trên lịch: **Đã xác nhận**, **Có thể** hoặc **Đã hủy**. Nhấp vào đó để chọn. Một sự kiện đã hủy vẫn ở trên lịch của bạn, được báo hủy thay vì bị xóa: nó bị gạch ngang trong mọi chế độ xem và giữ nguyên vị trí, và **Đã xác nhận** đưa nó trở lại. Nếu nó lặp lại, Mitra sẽ hỏi bạn muốn chọn lần lặp này, các lần sau hay tất cả.

Các ứng dụng lịch khác cũng đọc được việc hủy này. Lịch Apple, Thunderbird và Nextcloud gạch ngang sự kiện, và một sự kiện bị hủy trong một trong số đó sẽ hiện bị gạch ngang trong Mitra. Lịch Mitra và lịch CalDAV giữ được nó, còn lịch đăng ký hiển thị những gì nguồn cấp của nó đã hủy. Lịch Google, Notion và Tempo không giữ được, nên không đưa ra tùy chọn này.

## Bận hoặc rảnh và chế độ hiển thị

Hàng có biểu tượng con mắt cho biết người khác biết được gì từ mục khi họ xem lịch của bạn.

Sự kiện chọn giữa **Bận** và **Rảnh**. Bận, là mặc định, đánh dấu khoảng thời gian đó đã có việc, nên ai kiểm tra khi nào bạn rảnh để gặp sẽ thấy nó bị chặn. Rảnh hiển thị mục mà không chặn thời gian, phù hợp với lời nhắc cho chính bạn hoặc một ngày lễ mà bạn không nghỉ. Công việc không có bận hay rảnh. Thời gian khả dụng thì có, và bắt đầu là rảnh; xem [Thời gian khả dụng](availability.md#busy-or-free).

Mỗi mục có một chế độ hiển thị. **Chế độ hiển thị mặc định** để lịch quyết định. **Công khai** cho phép bất kỳ ai xem được lịch của bạn đọc mục này. **Riêng tư** yêu cầu các ứng dụng khác chỉ cho những người bạn chia sẻ lịch biết rằng thời gian đó đã có việc, chứ không cho biết là việc gì. **Bảo mật** là mức nghiêm ngặt nhất, dành cho những mục chỉ nên nằm giữa bạn và những người được mời. Mitra lưu lựa chọn của bạn cùng với mục, còn máy chủ và các ứng dụng đọc nó sẽ quyết định ẩn những gì.

## Địa điểm, người tham gia và hơn thế nữa

- [Địa điểm](location.md) chứa một nơi, kèm bản đồ, hoặc một liên kết cuộc họp.
- [Người tham gia](participants.md) liệt kê những người liên quan và phản hồi của họ.
- [Lời nhắc](reminders.md) thông báo cho bạn trước khi mục bắt đầu, hoặc trước hạn chót của một công việc.
- [Liên kết](links.md) tập hợp các liên kết trong phần mô tả phía trên.
- [Tệp đính kèm](attachments.md) chứa các tệp được thêm vào mục.
- **Công việc con của** và **Công việc con** tạo nên một cây công việc; xem [Công việc con](subtasks.md).
- **Bị chặn bởi** và **Chặn** cho biết việc gì phải xong trước; xem [Phụ thuộc](dependencies.md).

## Phần mô tả

Nhấp vào phần mô tả để chỉnh sửa, và nhấp ra chỗ khác để xem lại dạng đã định dạng. Nó được viết bằng Markdown, nên tiêu đề, danh sách gạch đầu dòng và danh sách đánh số, chữ đậm và chữ nghiêng, mã, bảng và liên kết đều được hiển thị. Một trích dẫn bắt đầu bằng `> [!NOTE]`, `> [!TIP]` hoặc `> [!WARNING]` sẽ trở thành một khung chú thích có màu. Nhấp vào một liên kết sẽ mở nó thay vì chỉnh sửa.

Những dòng bắt đầu bằng `- [ ]` trở thành danh sách kiểm, bạn có thể đánh dấu mà không cần mở văn bản. Xem [Danh sách kiểm](subtasks.md#checklists).

## Quan hệ từ các ứng dụng khác

Các ứng dụng lịch khác có thể liên kết các mục theo những cách mà Mitra không tự tạo ra. Mitra hiển thị các liên kết này trong một phần riêng: **Liên quan đến** cho những mục thuộc về nhau, và một phần mang tên loại liên kết cho những loại nó không biết. Bạn có thể xóa một liên kết như vậy bằng nút **✕**, nhưng không thể thêm.

## Những lịch nào hỗ trợ điều này

Mỗi lịch lưu những thứ khác nhau, và Mitra ẩn các hàng mà lịch không thể lưu, nên không có gì bạn nhập bị mất ở lần đồng bộ kế tiếp. Chẳng hạn, một lịch Notion chỉ chứa công việc, và một lịch Google không có quan hệ. Xem [Tích hợp](integrations/README.md#what-each-one-holds) để biết mỗi loại chứa những gì.
