---
title: Tệp lịch
description: "Mở tệp .ics và liên kết webcal:// bằng Mitra, và biến nó thành ứng dụng lịch mà máy tính của bạn dùng cho chúng."
---

Tệp lịch (`.ics`) và liên kết đăng ký (`webcal://`) là cách web phân phát sự kiện: một lời mời đính kèm trong email, một nút “Thêm vào lịch” trên trang đặt chỗ, một liên kết “Đăng ký” cho lịch thi đấu của một đội. Khi Mitra đã được cài đặt, nó có thể mở cả hai, và bạn có thể biến nó thành ứng dụng mà máy tính dùng cho chúng.

> [!NOTE]
> Mở tệp và liên kết cần Mitra được [cài thành ứng dụng](install-app.md) từ một trình duyệt nền Chromium trên máy tính, chẳng hạn Chrome, Edge, Brave hoặc Opera. Ở bất kỳ trình duyệt nào, bạn vẫn có thể kéo một tệp `.ics` vào Mitra.

## Đặt Mitra làm mặc định

Hãy cài đặt Mitra trước. Lần đầu một tệp lịch hoặc liên kết mở nó, trình duyệt có thể hỏi liệu Mitra có được xử lý hay không: chọn **Cho phép**. Sau đó, hãy bảo hệ thống mở các tệp `.ics` bằng Mitra.

Trên Windows, nhấp chuột phải vào một tệp `.ics` trong File Explorer và chọn **Open with → Choose another app**. Chọn **Mitra**, rồi **Always**. Bạn cũng có thể đổi sau trong **Settings → Apps → Default apps**.

Trên macOS, Control-nhấp vào một tệp `.ics` trong Finder và chọn **Get Info**. Trong **Open with**, chọn **Mitra**, rồi nhấp **Change All…** và xác nhận.

Trên Linux, nhấp chuột phải vào một tệp `.ics` trong trình quản lý tệp và mở **Properties → Open With**. Chọn **Mitra** và đặt làm mặc định.

Nếu Mitra đang mở, tệp hoặc liên kết bạn mở sẽ đi vào cửa sổ đó thay vì mở cửa sổ thứ hai.

## Thêm một tệp lịch

Mở một tệp `.ics` bằng Mitra, hoặc kéo nó vào Mitra từ màn hình nền hoặc trình quản lý tệp. Kéo thả cũng dùng được trong một tab trình duyệt thông thường, không cần cài đặt gì. Nhiều tệp sẽ mở lần lượt từng tệp.

Mitra hỏi thêm các mục vào lịch nào. Trước khi thêm bất cứ thứ gì, nó cho bạn thấy những gì lịch đó không lưu được: các mục sẽ bị bỏ qua, và những chi tiết mà một số mục sẽ mất, chẳng hạn lời nhắc trong một lịch không có lời nhắc. Để tiếp tục, nhấn nút nêu số mục sẽ được thêm, chẳng hạn **Thêm 12 mục**. Để chọn lịch khác, quay lại bằng mũi tên. Bản thân tệp không bao giờ thay đổi.

Mỗi mục được thêm dưới dạng một bản sao mới, nên thêm cùng một tệp hai lần sẽ cho bạn mỗi mục hai lần. Không có gì đã có trong lịch của bạn bị ghi đè.

Các công việc con và phụ thuộc giữa các mục của cùng một tệp vẫn được liên kết sau khi nhập. Một chuỗi lặp lại giữ nguyên các lần lặp đã xóa ở trạng thái đã xóa. Một chuỗi có các lần lặp đã chỉnh sửa, chẳng hạn một cuộc họp được dời sang ngày khác, sẽ bị bỏ qua, vì Mitra không thể thêm một chuỗi cùng với các chỉnh sửa của nó.

Nếu việc thêm thất bại giữa chừng, Mitra gỡ các mục đã thêm, nên không có gì từ tệp bị nhập dở dang. Nếu không gỡ được một số mục, nó cho bạn biết cần xóa thủ công bao nhiêu mục.

## Đăng ký từ liên kết webcal

Các trang web cho phép bạn đăng ký một lịch, chẳng hạn lịch thi đấu thể thao, các kỳ học hay ngày lễ, thường liên kết đến một địa chỉ `webcal://`. Nhấp vào một liên kết như vậy, và Mitra mở biểu mẫu **Lịch đăng ký** với địa chỉ đã điền sẵn. Hãy kiểm tra, điền **Tên người dùng (không bắt buộc)** và **Mật khẩu (không bắt buộc)** nếu nguồn cấp cần, và nhấn **Kết nối**. Sau đó bật lịch và nhấn **Lưu**.

Nhấp vào liên kết không bao giờ tự đăng ký: Mitra chỉ tải nguồn cấp khi bạn nhấn **Kết nối**.

Một lịch đăng ký là một lịch chỉ đọc mà Mitra giữ cập nhật từ nguồn cấp. Xem [Lịch đăng ký](integrations/subscriptions.md) để biết cách nó hoạt động.
