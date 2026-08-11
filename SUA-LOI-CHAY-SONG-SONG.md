# Vì sao giao diện lúc hiện kiểu này lúc kiểu khác

## Triệu chứng

- Tải lại trang thì lúc ra bố cục mới, lúc ra bố cục cũ.
- Bấm vào các mục lúc được lúc không.
- Chân trang báo **LỆCH BẢN**.

## Nguyên nhân

Nền tảng đang chạy **song song nhiều phiên bản**. Ở bảng điều khiển Mắt Bão,
nhiều phiên bản cùng hiện trạng thái "Trực tuyến" — v5, v6, v7, v8, v9, v10 đều xanh.

Bộ cân bằng tải chia lượt giữa các phiên bản đó. Mỗi lần tải trang bạn rơi vào một
phiên bản khác nhau, nên thấy giao diện khác nhau.

### Vì sao bấm vào lại không ăn

Tên tệp giao diện có kèm mã băm, ví dụ `index-BxD5GUS2.js`. Khi hai phiên bản chạy
song song, chuyện sau xảy ra:

1. Trình duyệt xin trang chủ, rơi vào **phiên bản A**, nhận `index.html` trỏ tới
   `index-AAAA.js`.
2. Trình duyệt xin tệp `index-AAAA.js`, lần này rơi vào **phiên bản B**, nơi không
   có tệp đó vì B dựng ra tên khác.
3. Máy chủ trả 404. Giao diện nạp thiếu, React không chạy, bấm vào đâu cũng im.

Đây chính là lý do "bấm không có phản hồi" mà không có thông báo lỗi nào.

## Cách xử lý

### Bước 1 — Xoá biến môi trường cũ

Bảng điều khiển Mắt Bão có nút **Môi trường**. Kiểm tra xem có biến
`PORTAL_BUILD` không. Nếu có, **xoá đi**.

Biến này được đặt từ lần triển khai trước với giá trị `STABLE-PG-20260808`, và nó
ghi đè lên số phiên bản trong mã nguồn. Đó là lý do máy chủ báo chuỗi cũ dù bạn đã
tải lên bản mới.

Từ bản 2026-08-09.v8 trở đi, mã nguồn không cho biến môi trường ghi đè nữa. Nhưng
vẫn nên xoá biến cũ cho sạch.

### Bước 2 — Chỉ giữ một phiên bản đang chạy

Đây là bước quan trọng nhất.

Vào danh sách phiên bản, **xoá tất cả trừ phiên bản mới nhất**. Nếu nền tảng không
cho xoá, tìm cách dừng các phiên bản cũ để chỉ còn đúng một phiên bản "Trực tuyến".

Không làm bước này thì mọi bản mới tải lên đều bị trộn với bản cũ.

### Bước 3 — Xác nhận

Mở `https://<tên-miền>/api/health` và kiểm tra:

```json
{
  "build": "2026-08-09.v8",
  "api_version": 6,
  "startup_ok": true,
  "database": "ok"
}
```

Tải lại trang đó **năm lần liên tiếp**. Cả năm lần đều phải ra cùng một chuỗi
`build`. Nếu có lần khác nhau, nghĩa là vẫn còn nhiều phiên bản chạy song song.

Sau đó mở trang chủ, kéo xuống chân trang. Hai chuỗi phải trùng nhau và không có
chữ LỆCH BẢN.

## Cách kiểm tra nhanh về sau

Từ bản này, mọi phản hồi của máy chủ đều kèm tiêu đề `X-Portal-Build`. Trên máy
tính có thể kiểm tra bằng một lệnh:

```
curl -sI https://<tên-miền>/ | grep -i x-portal-build
```

Chạy lệnh đó vài lần. Ra cùng một giá trị là chỉ có một phiên bản đang chạy.

## Tóm tắt

| Việc | Vì sao |
|---|---|
| Xoá biến `PORTAL_BUILD` ở mục Môi trường | Nó ghi đè số phiên bản, làm cảnh báo sai |
| Xoá các phiên bản cũ, chỉ giữ một | Chạy song song làm trộn tệp giữa các bản |
| Kiểm tra `/api/health` năm lần | Xác nhận chỉ còn một phiên bản |
| Nhấn `Ctrl + F5` | Xoá bản cũ trình duyệt còn giữ |
