---
title: Đăng nhập một lần
description: Chia sẻ một máy chủ Mitra với gia đình hoặc nhóm. Mọi người đăng nhập qua nhà cung cấp OpenID Connect bằng tài khoản họ đã có.
---

Mặc định, Mitra dành cho một người và không có đăng nhập, như vậy ổn khi chỉ mình bạn truy cập được. Để chia sẻ một máy chủ với gia đình hoặc nhóm, hãy kết nối nó với một nhà cung cấp OpenID Connect (OIDC). Khi đó mọi người đăng nhập bằng tài khoản họ đã có, và có lịch riêng mà không ai khác thấy.

Mitra hoạt động với bất kỳ nhà cung cấp OIDC chuẩn nào. Mọi người dùng nó với Pocket ID, Authelia, Authentik, Keycloak và Google, cùng nhiều nhà cung cấp khác.

> [!CAUTION]
> Bật đăng nhập sẽ cho mỗi người một tài khoản mới, trống, kể cả bạn. Mọi thứ bạn thiết lập khi Mitra còn dành cho một người vẫn ở lại tài khoản cũ và không chuyển sang: các tài khoản đã kết nối, cài đặt của bạn, và mọi mục trong [lịch Mitra](integrations/mitra.md) của bạn. Tài khoản đã kết nối thì thêm lại nhanh, nhưng các mục trong lịch Mitra không đi theo bạn được. Hãy bật đăng nhập trước khi bắt đầu điền dữ liệu vào Mitra, hoặc trước tiên chuyển các mục đó vào một lịch đã kết nối (**Di chuyển các mục đến…** trong menu **⋯** của lịch) rồi kết nối lại tài khoản đó sau.

## Bật đăng nhập

Đặt các biến OIDC cho container:

```yaml
services:
  mitra:
    image: ghcr.io/a11delavar/mitra:latest
    environment:
      MITRA_URL: 'https://mitra.example.com'          # the address people use to reach Mitra
      MITRA_OIDC_ISSUER: 'https://auth.example.com'   # your provider's issuer URL
      MITRA_OIDC_CLIENT_ID: 'mitra'
      MITRA_OIDC_CLIENT_SECRET: '…'                   # leave out for a public client
```

Tại nhà cung cấp, hãy đăng ký `MITRA_URL` theo sau là `/auth/callback` làm địa chỉ chuyển hướng:

```text
https://mitra.example.com/auth/callback
```

Nhà cung cấp chỉ cần vậy. Khởi động lại Mitra bằng `docker compose up -d`, và nó sẽ yêu cầu mọi người đăng nhập.

Đặt `MITRA_OIDC_ISSUER` là điều bật đăng nhập, và cũng cần `MITRA_OIDC_CLIENT_ID` và `MITRA_URL`. Nếu thiếu một trong số đó, Mitra từ chối khởi động. Lặng lẽ chạy mà không có đăng nhập sẽ tệ hơn nhiều.

## Client secret và scope

Nếu bạn đã đăng ký client secret tại nhà cung cấp, hãy đặt `MITRA_OIDC_CLIENT_SECRET`. Nếu bạn đã đăng ký public client, hãy bỏ nó đi; cách này được hỗ trợ đầy đủ, vì Mitra luôn dùng PKCE.

Mitra yêu cầu các scope `openid profile email`. `openid` là bắt buộc, và hai scope còn lại cho Mitra biết tên và email của mỗi người. Chỉ đổi chúng bằng `MITRA_OIDC_SCOPES` nếu nhà cung cấp của bạn cần thứ khác.

## Ai đăng nhập được

Bất kỳ ai nhà cung cấp của bạn cho qua đều có tài khoản Mitra vào lần đăng nhập đầu tiên. Mitra không có danh sách người dùng để quản lý, nên hãy quyết định ai được đăng nhập tại nhà cung cấp, theo nhóm, theo ứng dụng được gán hoặc cách nó xử lý quyền truy cập. Tên và email của mỗi người được cập nhật từ nhà cung cấp mỗi lần họ đăng nhập.

## Đăng nhập hoạt động thế nào

Việc đăng nhập diễn ra trên máy chủ (luồng authorization code với PKCE). Trình duyệt của bạn chỉ nhận một cookie, và không có mã nào được giữ trong bộ nhớ của nó, nên một đoạn script độc hại trên trang không có gì để đánh cắp.

Một phiên kéo dài 30 ngày kể từ lần cuối bạn dùng Mitra. Cookie được đánh dấu bảo mật khi `MITRA_URL` bắt đầu bằng `https://`, và issuer `http://` được phép cho các nhà cung cấp trong mạng riêng của bạn không có HTTPS. Nếu nhà cung cấp của bạn hỗ trợ, đăng xuất khỏi Mitra cũng đăng xuất bạn ở đó.

## Khắc phục sự cố

- **Mitra không khởi động và nêu tên một biến bị thiếu.** Khi đã đặt `MITRA_OIDC_ISSUER`, `MITRA_OIDC_CLIENT_ID` và `MITRA_URL` cũng phải được đặt.
- **Nhà cung cấp phàn nàn về địa chỉ chuyển hướng.** Nó phải đúng là `MITRA_URL` theo sau là `/auth/callback`.
- **Nhật ký báo discovery thất bại.** Mitra tra cứu nhà cung cấp của bạn ở lần đăng nhập đầu tiên và thử lại ở lần kế tiếp, nên nhà cung cấp khởi động sau Mitra sẽ tự ổn. Nếu vẫn thất bại, hãy kiểm tra URL issuer và xem Mitra có truy cập được nó không, với [mức nhật ký](logging.md) đặt ở `debug`.
- **Lịch của tôi biến mất sau khi bật đăng nhập.** Điều đó là bình thường: mọi người bắt đầu với một tài khoản mới. Hãy kết nối lại các tài khoản của bạn.
