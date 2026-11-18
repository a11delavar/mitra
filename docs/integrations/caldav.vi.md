---
title: CalDAV
description: Kết nối bất kỳ máy chủ CalDAV nào, như Nextcloud, Radicale, Fastmail hoặc mailbox.org, và đồng bộ hai chiều các sự kiện và công việc của nó.
---

CalDAV là chuẩn mở mà hầu hết các máy chủ lịch đều hỗ trợ. Bạn kết nối tài khoản CalDAV ngay từ ứng dụng, không cần thiết lập gì trên máy chủ, và Mitra sẽ đồng bộ hai chiều các sự kiện và công việc của tài khoản đó.

Lịch của bạn nằm trên máy chủ của bạn, nên mọi ứng dụng CalDAV khác bạn dùng, như lịch trên điện thoại, đều thấy cùng các mục. Đó là điểm khác với [lịch Mitra](mitra.md), thứ mà chỉ Mitra mới mở được.

## Kết nối tài khoản

1. Chọn **Thêm tích hợp** ở cuối thanh bên, rồi chọn **CalDAV**.
2. Điền vào biểu mẫu:
   - **URL máy chủ** là địa chỉ CalDAV của máy chủ bạn, chẳng hạn `https://caldav.example.com`. [Bảng bên dưới](#server-urls-for-common-providers) liệt kê địa chỉ này cho các nhà cung cấp phổ biến.
   - **Tên người dùng** thường là tên tài khoản hoặc địa chỉ email của bạn.
   - **Mật khẩu** là mật khẩu tài khoản của bạn, hoặc mật khẩu ứng dụng nếu nhà cung cấp có cấp.
3. Nhấn **Kết nối**. Mitra liệt kê các lịch của tài khoản, tất cả đều đang bật, và cho biết mỗi lịch chứa gì, chẳng hạn “Sự kiện · Công việc”.
4. Tắt những lịch bạn không muốn, rồi nhấn **Lưu**.

Mitra nhập các lịch bạn giữ lại, rồi đồng bộ chúng mỗi 10 giây khi bạn đang mở ứng dụng (xem [cách đồng bộ hoạt động](README.md#how-syncing-works)).

Để đổi mật khẩu sau này, mở menu **⋯** của tài khoản trên thanh bên, chọn **Sửa**, nhập mật khẩu mới và nhấn **Lưu**. URL máy chủ và tên người dùng được giữ nguyên; nếu muốn dùng tài khoản khác, hãy kết nối nó riêng.

## URL máy chủ cho các nhà cung cấp phổ biến

Hãy đưa cho Mitra địa chỉ CalDAV của nhà cung cấp, và Mitra sẽ tự tìm các lịch từ đó.

Nếu địa chỉ có nêu tên một người dùng, chẳng hạn `https://<your-radicale>/<user>/`, Mitra sẽ liệt kê các lịch của người dùng đó thay vì của bạn, trong phạm vi máy chủ chia sẻ chúng với bạn. Hãy kết nối từng địa chỉ riêng.

| Nhà cung cấp | URL máy chủ |
| --- | --- |
| Nextcloud | `https://<your-nextcloud>/remote.php/dav` |
| Radicale | `https://<your-radicale>/` (hoặc `.../<user>/`) |
| Fastmail | `https://caldav.fastmail.com/` |
| mailbox.org | `https://dav.mailbox.org/` |
| Baïkal | `https://<your-baikal>/dav.php` |

Google Lịch và iCloud cũng dùng CalDAV, nhưng chúng không nhận mật khẩu thông thường của bạn: Google cho bạn đăng nhập qua trang riêng của nó, còn Apple cần mật khẩu dành riêng cho ứng dụng. Hãy dùng ô riêng của chúng, như mô tả trong [Google Lịch](google.md) và [Lịch Apple](apple.md).

## Những gì được đồng bộ

Mỗi lịch trên máy chủ là một lịch trong Mitra. Lịch chứa sự kiện, công việc hoặc cả hai, tùy máy chủ cho phép. Hầu hết máy chủ cho phép cả hai; trong lịch chỉ nhận một loại, các mục mới luôn thuộc loại đó.

Mọi thứ Mitra lưu về một mục đều được đồng bộ, trong phạm vi máy chủ của bạn giữ được:

- Các mục cả ngày và nhiều ngày, địa điểm, mô tả, màu sắc và lời nhắc.
- Mục hiển thị là bận hay rảnh, và chế độ hiển thị của nó.
- Trạng thái và tiến độ của công việc.
- [Người tham gia](../participants.md). Máy chủ của bạn gửi lời mời và thu thập phản hồi.
- [Công việc con](../subtasks.md) và [phụ thuộc](../dependencies.md).
- [Tệp đính kèm](../attachments.md). Các ứng dụng khác trên cùng lịch sẽ thấy các tệp, và Mitra hiển thị những tệp do chúng thêm vào.

> [!NOTE]
> Các ứng dụng lịch khác chỉ đọc tên màu trên từng mục, nên chúng hiện màu của một mục bằng tên gần nhất, chẳng hạn màu xanh của Mitra thành `steelblue`. Mitra giữ đúng màu chính xác, và các bản cài Mitra khác cũng đọc lại được, trừ khi qua Google, vì Google bỏ nó đi.

Một mục lặp lại vẫn là một chuỗi lặp lại duy nhất trên máy chủ. Khi bạn thay đổi một lần lặp, Mitra hỏi bạn muốn áp dụng cho **Mục này**, **Mục này và các mục sau** hay **Tất cả các mục**, rồi sửa chuỗi cho khớp.

Một công việc giữ nguyên lịch trình, [hạn chót và ước tính](../planning.md#schedule-constraints-and-planning) của nó. Trên máy chủ, chúng được lưu như sau:

- Thời điểm bắt đầu là `DTSTART`.
- Độ dài là `ESTIMATED-DURATION`: thời gian công việc được lên lịch, hoặc ước tính của nó khi chưa có thời điểm bắt đầu.
- Hạn chót là `DUE`.

Một công việc có thời điểm bắt đầu mà không có độ dài là một khoảnh khắc.

Các lịch được chia sẻ cho bạn chỉ để xem sẽ được đánh dấu là chỉ đọc. Bạn vẫn có thể đổi tên, đổi màu, sắp xếp lại và ẩn chúng; xem [Lịch chỉ đọc](../calendars.md#read-only-calendars).

## Thời gian khả dụng ở trạng thái bận

[Thời gian khả dụng](../availability.md) bạn đánh dấu là **Bận** được thêm vào lịch của nó dưới dạng sự kiện bận, nên khoảng thời gian đó hiện là đã kín trên điện thoại của bạn và với bất kỳ ai mời bạn. Bạn không cần thiết lập gì.

- Mỗi khoảng thời gian khả dụng bận trở thành một sự kiện lặp lại với cùng giờ giấc và quy tắc lặp, được đánh dấu là bận. Sự kiện lấy tên của khoảng thời gian khả dụng, hoặc “Busy” nếu nó không có tên, cùng với địa điểm và chế độ hiển thị của nó, chẳng hạn **Riêng tư**.
- Bên trong Mitra, bạn thấy chính khoảng thời gian khả dụng thay vì các sự kiện này, để khoảng thời gian đó không hiện hai lần.
- Mitra giữ các sự kiện đồng bộ với thời gian khả dụng của bạn. Nếu một sự kiện bị thay đổi, di chuyển hoặc xóa trong ứng dụng khác, Mitra sẽ đặt nó lại ở lần đồng bộ tiếp theo.
- Đánh dấu lại thời gian khả dụng là **Rảnh**, xóa nó, tắt lịch của nó hoặc xóa tài khoản sẽ gỡ các sự kiện đi. Chuyển thời gian khả dụng sang lịch khác sẽ chuyển các sự kiện của nó theo.
- Lịch chỉ chứa công việc, hoặc lịch bạn không có quyền ghi, sẽ không có sự kiện nào.

> [!NOTE]
> Các thay đổi cho một ngày riêng lẻ của thời gian khả dụng bận không được chuyển sang. Sự kiện vẫn theo quy tắc lặp, nên một ngày bạn đã di chuyển hoặc rút ngắn vẫn hiện giờ thông thường của nó với người khác.

Điều này hoạt động giống nhau với [Google Lịch](google.md) và [Lịch Apple](apple.md), những dịch vụ mà Mitra cũng kết nối qua CalDAV.

## Khắc phục sự cố

- Nếu thiếu một lịch, tức là nó đang tắt. Điều đó xảy ra với các lịch bạn đã tắt khi kết nối, và với các lịch được tạo trên máy chủ sau đó, mà Mitra thêm vào ở trạng thái tắt. Hãy bật nó trong **⋯ → Sửa** của tài khoản rồi nhấn **Lưu**. Nút **Làm mới** ở đó sẽ liệt kê các lịch được tạo trên máy chủ kể từ lần đồng bộ trước.
- Nếu Mitra báo “This account is already connected”, tài khoản đó đã có trong thanh bên của bạn. Hãy thay đổi nó từ **⋯ → Sửa**, chẳng hạn để nhập mật khẩu mới.
- Nếu kết nối thất bại, hãy kiểm tra URL máy chủ có bắt đầu bằng `https://` và trỏ đến địa chỉ CalDAV, không phải trang web bạn đăng nhập. Để xem mọi yêu cầu Mitra gửi đến máy chủ, hãy đặt [mức nhật ký](../logging.md) thành `debug`.
- Nếu một lịch trông sai sau khi bạn cập nhật Mitra, hãy dùng **Nhập lại các mục** trong menu **⋯** của nó. Đồng bộ chỉ lấy những gì đã thay đổi trên máy chủ, nên các mục không đổi sẽ không bao giờ được đọc lại; nhập lại sẽ đọc tất cả. Xem [Nhập lại một lịch](../calendars.md#re-import-a-calendar).
