---
title: Tempo
description: Xem số giờ bạn ghi trong Tempo trên lịch của mình, và ghi, di chuyển, đổi kích thước và xóa chúng từ Mitra.
---

[Tempo](https://www.tempo.io/) là ứng dụng theo dõi thời gian cho Jira. Mitra hiển thị các **worklog** của bạn, tức số giờ bạn ghi trên các issue Jira, dưới dạng các mục có giờ trên lịch, cạnh các cuộc họp và công việc mà thời gian đó đã được dành cho.

Worklog được đồng bộ hai chiều. Di chuyển hoặc đổi kích thước một mục để thay đổi thời điểm và thời lượng bạn làm việc, sửa mô tả để đổi ghi chú của worklog, xóa nó để xóa worklog, hoặc tạo một mục để ghi thời gian mới.

Bạn kết nối từ ứng dụng bằng hai mã API. Không cần thiết lập gì trên máy chủ.

## Kết nối bảng chấm công của bạn

Mitra cần một mã từ Tempo và một mã từ Atlassian: Tempo giữ số giờ, còn Jira biết các issue và bạn là ai.

1. Tạo một mã API Tempo. Trong Jira, mở **Settings** của Tempo (biểu tượng bánh răng) → **Data Access** → **API integration**, chọn **New Token**, đặt tên “Mitra”, và sao chép mã.
2. Tạo một mã API Atlassian tại [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) bằng **Create API token**, rồi sao chép nó. Hãy tạo cả hai mã bằng cùng một người dùng Jira.
3. Trong Mitra, chọn **Thêm tích hợp** ở cuối thanh bên, rồi chọn **Tempo**, và điền:
   - **URL trang**, địa chỉ Atlassian của bạn, chẳng hạn `https://your-company.atlassian.net`.
   - **Mã API Tempo**, mã từ bước 1.
   - **Email tài khoản Atlassian**, địa chỉ email của tài khoản Atlassian của bạn.
   - **Mã API Atlassian**, mã từ bước 2.
4. Nhấn **Kết nối**. Mitra liệt kê một lịch, **My worklogs**.
5. Để nó bật và nhấn **Lưu**.

Tempo giới hạn tần suất các ứng dụng được gọi nó, nên Mitra đồng bộ với Tempo khoảng một lần mỗi phút (xem [cách đồng bộ hoạt động](README.md#how-syncing-works)).

## Worklog trông như thế nào

Tiêu đề của một mục là issue Jira mà thời gian được ghi vào, gồm khóa và tóm tắt của nó:

```text
ACME-1234 Code review for auth migration
```

Ghi chú của worklog là mô tả của mục. Ứng dụng Tempo cũng hiển thị chúng như vậy, vì issue cho biết thời gian đó dành cho việc gì, còn ghi chú thường là nhãn hoạt động như “Review”, hoặc văn bản Jira viết sẵn cho bạn, như “Working on work item ACME-1234”.

Tiêu đề thuộc về issue, nên bạn không thể sửa nó trên một worklog đã lưu: Mitra không đổi tên một issue Jira chỉ vì bạn sửa một mục lịch. Hãy sửa mô tả để nói bạn đã làm gì. Nếu Jira không thể gọi tên issue, vì nó đã bị xóa hoặc bạn không còn thấy nó, tiêu đề hiển thị `#` và ID của issue, và mục vẫn hoạt động bình thường.

Tempo lưu worklog dưới dạng giờ đồng hồ thuần, không có múi giờ. Mitra đọc chúng theo múi giờ trong hồ sơ Jira của bạn, nên chúng hiện đúng giờ như trong Tempo.

Một số trang Tempo tắt giờ bắt đầu. Ở đó, mọi worklog trong một ngày bắt đầu cùng một lúc, nên chúng chồng lên nhau, nhưng độ dài của chúng vẫn đúng.

## Ghi thời gian từ Mitra

Tạo một mục có giờ trong **My worklogs**, và đặt khóa issue Jira ở bất kỳ đâu trong tiêu đề:

| Bạn nhập | Được ghi vào |
| --- | --- |
| `ACME-1234 Team standup` | `ACME-1234` |
| `Investigating ACME-1234 regression` | `ACME-1234` |
| `ACME-1234` | `ACME-1234` |

Mitra kiểm tra khóa với các dự án Jira bạn có thể thấy. Nếu tiêu đề không có khóa như vậy, hoặc Jira không có issue đó, Mitra không ghi gì cả và cho bạn biết lý do.

Ghi chú của worklog là những gì bạn viết trong mô tả, hoặc, nếu bạn để trống, là toàn bộ tiêu đề như bạn đã nhập. Khi thời gian đã được ghi, tiêu đề trở thành khóa và tóm tắt của issue. Việc hoán đổi đó chỉ xảy ra một lần, lúc bạn ghi, nên bạn có thể sửa tiêu đề khi đang viết nhưng không thể sửa sau đó.

> [!TIP]
> Để ghi thời gian vào một issue bạn đã ghi trước đó, hãy nhân bản một mục của nó: giữ <kbd>Alt</kbd> (<kbd>⌥</kbd> trên Mac) trong khi kéo nó đến giờ mới, hoặc chọn **Nhân bản** trong menu **⋯** của trình chỉnh sửa.

## Thay đổi một worklog

Di chuyển, đổi kích thước, xóa và sửa mô tả đều được gửi thẳng đến Tempo. Có vài điều cần biết:

- Một worklog luôn ở trên issue của nó. Tempo không thể chuyển worklog sang issue khác, nên để ghi thời gian vào chỗ khác, hãy xóa mục và tạo mục mới với khóa đúng.
- Mitra giữ các chi tiết riêng của Tempo về một worklog, như thời gian tính phí và thuộc tính công việc, khi thay đổi nó.
- Khi một kỳ chấm công đã đóng hoặc được duyệt trong Tempo, Tempo từ chối thêm, sửa hoặc xóa worklog trong kỳ đó.

Để mở issue trong Jira, chọn **Mở trong Jira** trong menu **⋯** của trình chỉnh sửa.

## Những gì một worklog không chứa được

Một worklog là một khoảng thời gian trong một ngày, được ghi vào một issue. Vì vậy một lịch Tempo chỉ chứa các mục có giờ: không có mục cả ngày, lặp lại, lời nhắc, địa điểm, người tham gia, [tệp đính kèm](../attachments.md), quan hệ, bận hay rảnh, chế độ hiển thị hay [thời gian khả dụng](../availability.md). Mitra ẩn các trường này trên worklog.

## Khắc phục sự cố

- Nếu Mitra báo “Tempo rejected the API token”, hãy tạo một mã API Tempo mới và nhập nó trong **⋯ → Sửa** của tài khoản.
- Nếu Mitra báo “Jira rejected the e-mail and API token”, hãy kiểm tra địa chỉ email có thuộc về tài khoản Atlassian đã tạo mã API hay không.
- Nếu worklog hiện sai giờ trong ngày, hãy kiểm tra múi giờ trong hồ sơ Jira của bạn (**Account settings** → **Time zone**). Sau khi đổi, hãy dùng **Nhập lại các mục** trong menu **⋯** của **My worklogs**, để các worklog bạn đã có cũng được dời theo.
- Nếu worklog chồng lên nhau cùng một giờ mỗi ngày, trang Tempo của bạn đã tắt giờ bắt đầu. Số giờ vẫn đúng.
