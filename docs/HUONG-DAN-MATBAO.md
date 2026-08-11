# Triển khai trên Mắt Bão (Vibe Host) hoặc nền tảng tương tự

Dành cho trường hợp bạn đã có gói hosting kiểu "deploy website", không phải máy chủ ảo có SSH.

---

## 1. Vì sao đăng nhập chưa được

Trên bảng điều khiển Mắt Bão có dòng:

```
Tổng cộng: 1 · 1 website đang chạy · 0 database
```

Bạn mới đẩy lên **phần giao diện**. Cổng thông tin gồm ba phần:

| Phần | Việc của nó | Đã có chưa |
|---|---|---|
| Giao diện | Những gì nhìn thấy trên màn hình | Đã có |
| Phần xử lý | Kiểm tra mật khẩu, đọc ghi dữ liệu | **Chưa có** |
| Cơ sở dữ liệu | Nơi lưu tin bài, tài khoản, số liệu | **Chưa có** |

Không có phần xử lý thì không có gì kiểm tra mật khẩu. Trang báo "Sai tài khoản hoặc mật khẩu" là do thông báo lỗi chưa chuẩn — bản mới nhất đã sửa thành "Chưa kết nối được máy chủ dữ liệu".

**Cách tự kiểm tra bất cứ lúc nào:** mở `vcchcm.com/api/health`. Thấy `{"status":"ok"}` là phần xử lý đang chạy. Không thấy tức là chưa có.

---

## 2. Cách khắc phục

Tôi đã đóng gói lại thành **một dịch vụ duy nhất**: một tiến trình vừa phát giao diện, vừa xử lý dữ liệu, vừa lưu trữ. Không cần tạo database riêng, không cần cấu hình gì.

Chọn một trong ba cách dưới đây, tuỳ vào những gì bảng điều khiển Mắt Bão cho phép.

---

### Cách A — Nền tảng cho chạy Docker *(gọn nhất)*

Nếu khi tạo website có tuỳ chọn **Docker** hoặc ô hỏi đường dẫn `Dockerfile`:

1. Đẩy toàn bộ thư mục `portal-cnct` lên (không chỉ file HTML).
2. Chọn kiểu triển khai **Dockerfile**, đường dẫn để `./Dockerfile` (ở thư mục gốc).
3. Cổng ứng dụng: `8000`, hoặc để nền tảng tự cấp qua biến `PORT`.
4. Bấm Deploy. Lần đầu mất 5–10 phút vì phải dựng giao diện.

Xong, mở `vcchcm.com/api/health` để xác nhận.

---

### Cách B — Nền tảng cho chạy ứng dụng Python

Nếu có tuỳ chọn runtime **Python** và ô nhập lệnh:

| Ô | Điền |
|---|---|
| Runtime | Python 3.11 hoặc 3.12 |
| Lệnh cài đặt | `pip install -r backend/requirements.txt` |
| Lệnh khởi chạy | `bash start.sh` |
| Cổng | `8000` hoặc để trống nếu nền tảng tự cấp `PORT` |

Bộ mã nguồn đã kèm sẵn giao diện dựng sẵn trong `backend/static`, nên **không cần cài Node.js**.

---

### Cách C — Chuyển sang Cloud VPS *(nên chọn nếu dùng lâu dài)*

Mắt Bão có bán Cloud VPS riêng. Loại này cho toàn quyền SSH, chạy được Docker, dùng PostgreSQL thật.

1. Mua Cloud VPS Ubuntu 22.04, 2 nhân CPU, 4 GB RAM.
2. Chép mã nguồn lên: `scp -r portal-cnct root@<IP>:~/`
3. Chạy: `cd portal-cnct && bash deploy-vps.sh`

Script tự lo cả HTTPS. Xem chi tiết tại `docs/HUONG-DAN-VPS.md`.

**Gói hiện tại của bạn là Vibe Host Pro Trial dùng thử 7 ngày.** Hết hạn là trang tắt, nên dù chọn cách nào cũng cần quyết định sớm.

---

## 3. Dữ liệu lưu ở đâu

Khi chạy theo Cách A hoặc B mà không tạo database riêng, hệ thống tự dùng SQLite, lưu tại thư mục `data/portal.db`.

**Điều phải kiểm tra: thư mục này có được giữ lại sau mỗi lần deploy không?**

Nhiều nền tảng xoá sạch mọi thứ mỗi lần triển khai lại. Nếu vậy, mỗi lần deploy là mất hết tin bài đã đăng.

Hỏi hỗ trợ Mắt Bão đúng một câu:

> *"Dịch vụ Vibe Host có hỗ trợ ổ đĩa lưu trữ bền (persistent volume) gắn vào thư mục /app/data không? Nếu không thì có PostgreSQL để tôi kết nối vào không?"*

Có ba khả năng:

| Trả lời | Bạn làm gì |
|---|---|
| Có persistent volume | Gắn vào `/app/data`, xong |
| Có PostgreSQL | Tạo database, lấy chuỗi kết nối, đặt vào biến `DATABASE_URL` |
| Không có cả hai | Chuyển sang Cloud VPS theo Cách C |

Nếu dùng PostgreSQL, chỉ cần đặt hai biến môi trường:

```
DATABASE_URL = postgresql://tên:mậtkhẩu@máychủ:5432/tênDB
SECRET_KEY   = <chuỗi ngẫu nhiên 64 ký tự>
```

Hệ thống tự nhận cả dạng `postgres://` lẫn `postgresql://`.

---

## 4. Về tên miền và HTTPS

Bảng điều khiển đang hiện `vcchcm.tinhgon.xyz` kèm nút **Gắn domain riêng**. Bấm vào đó, khai báo `vcchcm.com`, làm theo hướng dẫn trỏ DNS của Mắt Bão.

Sau khi gắn domain, hầu hết nền tảng tự cấp chứng chỉ HTTPS. Chờ 10–30 phút rồi kiểm tra lại — dòng `Not secure` sẽ biến mất, thay bằng ổ khoá.

Nếu sau một tiếng vẫn `Not secure`, liên hệ hỗ trợ Mắt Bão hỏi về SSL cho domain riêng.

---

## 5. Sau khi đăng nhập được

- [ ] Đổi mật khẩu ba tài khoản mặc định trong **Quản trị → Quản lý tài khoản**
- [ ] Đặt biến `SECRET_KEY` bằng chuỗi ngẫu nhiên riêng
- [ ] Tải bản sao lưu cơ sở dữ liệu định kỳ: **Quản trị → Cấu hình website → Tải tệp cơ sở dữ liệu**
- [ ] Điền đường dẫn thật cho GNOC, NIMS, Portal Viettel

---

## 6. Bảng tra nhanh sự cố

| Hiện tượng | Kiểm tra | Nguyên nhân |
|---|---|---|
| Đăng nhập báo lỗi | Mở `/api/health` | Không thấy `{"status":"ok"}` → phần xử lý chưa chạy |
| Trang trắng | Nhấn `Ctrl + F5` | Trình duyệt nhớ bản cũ |
| Deploy xong mất hết dữ liệu | Xem mục 3 | Nền tảng không giữ thư mục `data` |
| Vẫn `Not secure` | Xem mục 4 | Domain riêng chưa được cấp SSL |
| Trang tắt sau 7 ngày | — | Gói dùng thử hết hạn |
