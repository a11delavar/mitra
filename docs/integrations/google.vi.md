---
title: Google Lịch
description: Thiết lập đăng nhập Google một lần cho máy chủ Mitra của bạn, rồi kết nối các tài khoản Google từ ứng dụng và đồng bộ hai chiều các lịch của chúng.
---

Mitra kết nối với Google Lịch qua CalDAV, như với bất kỳ máy chủ lịch nào. Điểm khác là cách đăng nhập: Google không nhận mật khẩu, mà yêu cầu bạn cấp quyền truy cập trên trang riêng của nó. Vì vậy, Google cần biết máy chủ Mitra của bạn, nên người vận hành máy chủ đăng ký nó với Google một lần và đưa cho Mitra ID khách và mã bí mật mà Google cấp.

Sau đó, bất kỳ ai dùng Mitra đều có thể kết nối tài khoản Google của mình từ ứng dụng, mỗi người với quyền truy cập riêng. Việc thiết lập gồm ba bước:

1. [Đăng ký Mitra với Google](#register-mitra-with-google).
2. [Đưa cho Mitra ID khách và mã bí mật](#give-mitra-the-client-id-and-secret).
3. [Kết nối một tài khoản](#connect-an-account).

Hai bước đầu chỉ làm một lần cho mỗi máy chủ Mitra.

## Đăng ký Mitra với Google

1. Tạo một dự án trong [Google Cloud console](https://console.cloud.google.com), và trong **APIs & Services**, bật **CalDAV API**.
2. Cấu hình **OAuth consent screen**. Hãy thêm bạn và mọi người khác sẽ kết nối tài khoản làm **test user**, hoặc xuất bản ứng dụng.
3. Tạo một **OAuth client** loại **Web application**. Ở **authorized redirect URI**, nhập địa chỉ máy chủ Mitra của bạn theo sau là `/api/integrations/google/callback`:

   ```text
   https://mitra.example.com/api/integrations/google/callback
   ```

4. Sao chép **client ID** và **client secret** mà Google hiển thị.

> [!CAUTION]
> Khi màn hình đồng ý đang ở chế độ thử nghiệm, Google kết thúc mỗi quyền truy cập sau 7 ngày, và mọi người phải kết nối lại tài khoản mỗi tuần. Hãy xuất bản ứng dụng để giữ quyền truy cập lâu dài.

## Đưa cho Mitra ID khách và mã bí mật

Đặt chúng làm biến môi trường, cùng với `MITRA_URL`, địa chỉ máy chủ của bạn:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'
      MITRA_GOOGLE_CLIENT_ID: '….apps.googleusercontent.com'
      MITRA_GOOGLE_CLIENT_SECRET: '…'
    # …
```

Rồi khởi động lại Mitra:

```bash
docker compose up -d
```

Hãy đặt cả hai biến hoặc không đặt biến nào. Mitra từ chối khởi động khi có ID khách mà không có mã bí mật, để một thiết lập dang dở không bao giờ bị bỏ sót.

`MITRA_URL` phải khớp với địa chỉ trong redirect URI của bạn. Nếu không có nó, Mitra dùng địa chỉ bạn đã mở nó, đủ để thử trên `localhost`. Google chỉ chấp nhận địa chỉ chuyển hướng `https://` cho mọi thứ không phải `localhost`, nên một máy chủ thật cần [HTTPS](../configuration.md#put-it-behind-https) và `MITRA_URL`. Tất cả các biến được liệt kê trong [Cấu hình](../configuration.md#all-variables).

## Kết nối một tài khoản

1. Chọn **Thêm tích hợp** ở cuối thanh bên, rồi chọn **Google Lịch**.
2. Nhấn **Tiếp tục với Google**. Google yêu cầu bạn chọn một tài khoản và cho phép Mitra xem và thay đổi các lịch của bạn.
3. Quay lại Mitra, các lịch của tài khoản được liệt kê, tất cả đều đang bật. Tắt những lịch bạn không muốn, rồi nhấn **Lưu**.

Kết nối lại cùng một tài khoản Google sẽ làm mới quyền truy cập của nó thay vì thêm nó lần thứ hai.

Google giới hạn tần suất các ứng dụng được gọi nó, nên Mitra đồng bộ các tài khoản Google khoảng một lần mỗi phút (xem [cách đồng bộ hoạt động](README.md#how-syncing-works)).

## Các lịch được chia sẻ cho bạn

Các lịch bạn sở hữu hiện ra ngay khi bạn kết nối. Các lịch người khác chia sẻ cho bạn, như lịch của một nhóm hoặc của đồng nghiệp, chỉ đến được các ứng dụng khác khi bạn cho phép trong cài đặt Google của mình:

1. Khi đã đăng nhập Google, mở [calendar.google.com/calendar/syncselect](https://calendar.google.com/calendar/syncselect).
2. Trong **Shared Calendars**, đánh dấu từng lịch bạn muốn có trong Mitra, rồi nhấn **Save**.
3. Trong Mitra, mở menu **⋯** của tài khoản trên thanh bên, chọn **Sửa**, và nhấn **Làm mới**.
4. Bật các lịch xuất hiện, rồi nhấn **Lưu**.

Một lịch được chia sẻ cho bạn với quyền **See all event details** là chỉ đọc trong Mitra: bạn thấy mọi thứ trong đó, nhưng không thể thêm, sửa hay xóa sự kiện. Nếu sau này chủ lịch cấp cho bạn quyền **Make changes to events**, việc chỉnh sửa sẽ được bật ở lần đồng bộ tiếp theo. Xem [Lịch chỉ đọc](../calendars.md#read-only-calendars).

## Những gì được đồng bộ

Mọi thứ được đồng bộ như với [CalDAV](caldav.md#what-syncs), trừ quan hệ giữa các mục, thứ mà Google bỏ khỏi bản sao sự kiện của nó, nên Mitra không cung cấp chúng trên các lịch Google.

[Tệp đính kèm](../attachments.md) trên một lịch Google là các tệp Google Drive bạn đính kèm trong Google Lịch. Mitra hiển thị chúng, mỗi tệp mở trong Drive, nhưng không thể thêm hay gỡ tệp nào: Google chỉ giữ các tệp Drive và bỏ tệp đính kèm do ứng dụng khác thêm.

[Thời gian khả dụng](../availability.md) bạn đánh dấu là bận trong một lịch Google được thêm vào lịch đó dưới dạng sự kiện bận, để người khác thấy khoảng thời gian đó đã kín. Nó hoạt động như mô tả cho [CalDAV](caldav.md#busy-availability).

## Mã Google của bạn

Mã mà Google cấp không bao giờ rời khỏi máy chủ. Trình duyệt của bạn chỉ đi qua trang của Google để cấp quyền truy cập. Mitra giữ mã cùng với tài khoản và dùng nó để lấy quyền truy cập ngắn hạn mỗi khi đồng bộ.

## Ngắt kết nối một tài khoản

Chọn **Xóa** trong menu **⋯** của tài khoản để gỡ nó, cùng mã của nó, khỏi Mitra. Để thu hồi quyền truy cập của Mitra ở phía Google, hãy gỡ Mitra khỏi [các kết nối bên thứ ba của tài khoản Google](https://myaccount.google.com/permissions) của bạn. Chỉ làm vậy thì việc đồng bộ cũng dừng: tài khoản vẫn ở trong Mitra, nhưng mọi lần đồng bộ đều thất bại cho đến khi bạn kết nối lại.

## Khắc phục sự cố

- Nếu khi chọn **Google Lịch**, thay vì nút **Tiếp tục với Google** bạn thấy ghi chú rằng nó chưa được cấu hình trên máy chủ này, thì `MITRA_GOOGLE_CLIENT_ID` và `MITRA_GOOGLE_CLIENT_SECRET` chưa được đặt, hoặc Mitra chưa khởi động lại kể từ khi bạn đặt chúng.
- Nếu Google trả lời `redirect_uri_mismatch`, redirect URI trong Google Cloud console không khớp với `MITRA_URL` theo sau là `/api/integrations/google/callback`. Nó phải khớp chính xác, kể cả `https://` và không có dấu gạch chéo ở cuối.
- Nếu các tài khoản ngừng đồng bộ sau 7 ngày, màn hình đồng ý của bạn vẫn đang ở chế độ thử nghiệm. Hãy xuất bản ứng dụng, rồi kết nối lại các tài khoản.
