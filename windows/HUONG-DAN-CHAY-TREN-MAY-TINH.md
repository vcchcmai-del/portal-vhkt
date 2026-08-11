# Chạy cổng thông tin trên máy tính cá nhân (Windows, dữ liệu ổ D)

## Trả lời ngắn

**Được.** Máy tính cá nhân đủ sức chạy cổng thông tin này cho một chi nhánh. Phần mềm nhẹ, dữ liệu chủ yếu là chữ.

Nhưng chỉ nên dùng cho **giai đoạn thử nghiệm và trình diễn**, không nên dùng làm hệ thống chính thức lâu dài. Lý do ở Mục 5.

---

## 1. Cần chuẩn bị

| Việc | Ghi chú |
|---|---|
| Windows 10 hoặc 11 | Máy đang dùng là được |
| Python 3.10 trở lên | Tải tại python.org — **khi cài nhớ tích ô "Add Python to PATH"** |
| Còn trống 2 GB | Dữ liệu sẽ nằm tại thư mục `data\` cạnh thư mục `windows\` trong bộ mã nguồn |
| Máy nối cùng mạng LAN với đồng nghiệp | Để anh em khác mở được |

Không cần Docker. Không cần cài PostgreSQL.

---

## 2. Cài đặt — ba lần bấm chuột

Giải nén bộ mã nguồn ra một thư mục, ví dụ `D:\portal-cnct`. Vào thư mục `windows`, rồi:

**Lần 1 — nhấn đúp `1-CAI-DAT-LAN-DAU.bat`**

Script tự kiểm tra Python, tự tạo thư mục `data\`, tự cài thư viện. Mất 1–3 phút. Chỉ chạy một lần duy nhất.

**Lần 2 — nhấn đúp `2-KHOI-DONG.bat`**

Cửa sổ đen hiện lên, trình duyệt tự mở vào cổng thông tin. Cửa sổ đen này **phải để nguyên** — đóng nó là web tắt.

Trên màn hình sẽ hiện hai địa chỉ:

```
Mở trên máy này:      http://localhost:8000
Máy khác trong mạng:  http://192.168.1.25:8000
```

Địa chỉ thứ hai là thứ bạn gửi cho đồng nghiệp.

**Nếu quên mật khẩu** — nhấn đúp `4-QUEN-MAT-KHAU.bat`, chọn tài khoản và đặt mật khẩu mới. Không mất dữ liệu.

**Lần 3 — Windows hỏi quyền mạng**

Lần đầu chạy, Windows hiện hộp thoại hỏi có cho Python truy cập mạng không. Chọn **Allow access** và tích vào **Private networks**. Không cho thì máy khác không vào được.

---

## 3. Dữ liệu nằm ở đâu

```
<thư mục cài đặt>\data\
├── portal.db        ← Toàn bộ dữ liệu nằm trong đúng một file này
├── secret.key       ← Khoá ký token đăng nhập, giữ kín
└── backups\         ← Nơi chứa bản sao lưu
```

Toàn bộ tin bài, tài liệu, danh bạ, số liệu, sáng kiến, thảo luận đều nằm trong `portal.db`.

**Sao lưu = chép file đó đi chỗ khác.** Nhấn đúp `3-SAO-LUU.bat` là xong, bản sao vào thư mục `backups` kèm ngày giờ.

Nên chép thêm bản sao ra USB hoặc Google Drive mỗi tuần. Ổ cứng hỏng là mất hết, và ổ cứng máy cá nhân hỏng thường xuyên hơn máy chủ.

---

## 4. Đặt trang này làm trang chủ cho anh em

Trên máy mỗi người:

- **Chrome / Edge**: Cài đặt → Khi khởi động → Mở một trang cụ thể → dán địa chỉ `http://192.168.1.25:8000` (thay bằng địa chỉ thật của máy bạn).
- **Cốc Cốc**: tương tự Chrome.

**Lưu ý quan trọng:** địa chỉ IP của máy cá nhân thường thay đổi mỗi lần khởi động lại. Khi đó anh em sẽ mở ra trang lỗi. Nhờ bộ phận hạ tầng đặt **IP tĩnh** cho máy bạn để tránh việc này.

---

## 5. Những điều phải biết trước khi quyết định

Tôi nói thẳng để bạn cân nhắc, vì đây là quyết định của bạn chứ không phải của tôi.

**Điểm được:**
- Triển khai ngay hôm nay, không phải xin ai duyệt hạ tầng.
- Không tốn chi phí.
- Đủ dùng cho vài chục người truy cập cùng lúc.
- Chứng minh được giá trị trước khi xin máy chủ thật.

**Điểm chưa được:**

| Vấn đề | Hậu quả |
|---|---|
| Tắt máy là web sập | Anh em mở trang chủ thấy lỗi. Máy cá nhân thì tắt hằng ngày. |
| IP hay đổi | Địa chỉ đã gửi cho mọi người bỗng không vào được. |
| Máy bạn chậm đi | Nhất là khi nhiều người dùng cùng lúc. |
| Máy hỏng là mất dữ liệu | Trừ khi bạn sao lưu đều đặn ra chỗ khác. |
| Rủi ro an toàn thông tin | Máy cá nhân không có các lớp bảo vệ của máy chủ. |
| Bạn thành người trực hệ thống | Ai gặp lỗi cũng gọi bạn, kể cả ngoài giờ. |

**Vấn đề cần hỏi trước:** Viettel có quy định về an toàn thông tin. Việc dựng một dịch vụ dùng chung trên máy cá nhân, chứa danh bạ và số liệu điều hành nội bộ, có thể **không được phép**. Trước khi mời anh em vào dùng, bạn nên hỏi bộ phận an toàn thông tin hoặc hạ tầng của chi nhánh một câu ngắn gọn: *"Em dựng thử một trang nội bộ trên máy làm việc, chứa danh bạ và số liệu điều hành, có được không?"*

Nếu chỉ mở cho vài người trong phòng xem thử thì thường không sao. Nếu định mở cho cả chi nhánh thì phải hỏi.

---

## 6. Đề xuất của tôi

Chia làm ba bước, giảm rủi ro mà vẫn đi nhanh:

**Bước 1 — Trình diễn (làm ngay, không cần cài gì)**
Dùng file `cong-thong-tin-noi-bo.html`. Nhấn đúp là mở. Gửi cho Ban Giám đốc và các trưởng phòng xem, lấy góp ý.

**Bước 2 — Thử nghiệm hẹp (máy cá nhân, 2–4 tuần)**
Chạy theo hướng dẫn này, mở cho một phòng dùng thử. Ghi lại góp ý và số lượt truy cập. Đây là bằng chứng để trình xin máy chủ.

**Bước 3 — Chính thức (máy chủ chi nhánh)**
Khi có chủ trương, chép cả thư mục lên máy chủ và chạy `deploy.sh`. Dữ liệu từ bước 2 chuyển sang được.

Làm theo thứ tự này thì đến lúc trình xin máy chủ, bạn không xin một ý tưởng — bạn xin cho một thứ đã chạy và đã có người dùng.

---

## 7. Nếu máy đã có Docker Desktop

Có thể chạy đúng như môi trường máy chủ thật, dữ liệu vẫn để ổ D:

```
docker compose -f docker-compose.windows.yml up -d --build
```

Trước đó vào Docker Desktop → Settings → Resources → File sharing, thêm ổ D. Cách này nặng máy hơn nhưng khi chuyển lên máy chủ thì gần như không phải sửa gì.

---

## 8. Sự cố thường gặp

| Hiện tượng | Xử lý |
|---|---|
| Nhấn `.bat` thấy chớp rồi tắt | Chưa cài Python, hoặc cài mà quên tích "Add Python to PATH". Cài lại Python. |
| Báo "Khong tim thay o D" | Máy không có ổ D. Mở `3-CAU-HINH.txt`, đổi sang ổ khác. |
| Máy khác không vào được | Chưa cho qua tường lửa. Xem mục 3 trong `3-CAU-HINH.txt`. |
| Báo cổng 8000 đang bận | Đổi `PORT=8000` thành `8080` trong `2-KHOI-DONG.bat`. |
| Đang dùng thì web tắt | Ai đó đóng cửa sổ đen, hoặc máy ngủ. Chạy lại `2-KHOI-DONG.bat`. |
| Muốn xoá hết làm lại | Xoá `portal.db` trong thư mục `data\` rồi khởi động lại. |
| Đăng nhập báo sai mật khẩu | Nhấn đúp `4-QUEN-MAT-KHAU.bat` để đặt lại. Không mất dữ liệu. |
