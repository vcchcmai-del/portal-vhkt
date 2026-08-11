# Kết quả rà soát và những gì đã sửa

## A. Vấn đề đã phát hiện

### A1. Bản dựng giao diện cũ hơn mã nguồn — NGHIÊM TRỌNG

Thư mục `backend/static/assets/` chứa bản dựng cũ (`index-Blzs7FPA.js`), thiếu các
tính năng đã có trong `frontend/src/`. Cụ thể chức năng **Biểu tượng ứng dụng** có
trong mã nguồn nhưng không có trong bản đang chạy.

Hệ quả: đã phải thêm `cnct-icon-enhancement.js` — một script chạy sau React rồi
chèn thêm ô nhập vào hộp thoại bằng cách dò tìm phần tử theo nhãn tiếng Việt.

Cách này rất dễ vỡ: chỉ cần đổi chữ "Đường dẫn mở ứng dụng" thành chữ khác là
script mất tác dụng, mà không báo lỗi gì. Đây là lần thứ hai gặp cách vá kiểu này
(trước đó là `portal-home.js`).

**Đã xử lý:** dựng lại giao diện từ mã nguồn, gỡ `cnct-icon-enhancement.js` và gỡ
dòng nạp script trong `index.html`. Bản dựng mới đã có đủ chức năng.

**Nguyên nhân gốc:** không dựng lại được giao diện trên máy triển khai. Xem mục C.

### A2. Kiểm tra sức khoẻ gây khởi động lại nhầm — QUAN TRỌNG

`/api/health` trả 503 khi cơ sở dữ liệu hỏng. Các nền tảng triển khai dùng đường dẫn
này để quyết định có giết và dựng lại container hay không. Cơ sở dữ liệu gián đoạn
vài giây sẽ khiến nền tảng liên tục khởi động lại ứng dụng — làm hỏng thêm, vì lỗi
nằm ở cơ sở dữ liệu chứ không phải ở ứng dụng.

**Đã xử lý:** tách làm hai đường dẫn.

| Đường dẫn | Ý nghĩa | Khi CSDL hỏng |
|---|---|---|
| `/api/health` | Ứng dụng còn sống | HTTP 200, kèm `database: "error"` |
| `/api/health/ready` | Sẵn sàng phục vụ | HTTP 503 |

Cấu hình nền tảng trỏ health check vào `/api/health`, không phải `/api/health/ready`.

Giao diện cũng phân biệt hai tình huống: "chưa có máy chủ" khác với "máy chủ chạy
nhưng chưa nối được cơ sở dữ liệu".

### A3. Tệp trùng chức năng

| Nhóm | Trước | Sau |
|---|---|---|
| Tài liệu ở thư mục gốc | 10 tệp | 2 tệp, phần còn lại chuyển vào `docs/lich-su/` |
| Script đặt lại mật khẩu | `reset_admin.py` và `reset_password.py` | Giữ `reset_password.py` (đầy đủ hơn) |
| Tệp `.pyc` biên dịch | 12 tệp lọt vào gói | Đã xoá |

Năm tệp `docker-compose.*.yml` và bốn script sao lưu thì giữ nguyên — chúng phục vụ
các môi trường khác nhau, không phải trùng lặp.

### A4. Nhận định sai của lần rà soát trước — đã sửa

Lần trước tôi kết luận `backend/app/server.py` là mã chết. **Sai.** Nó chính là lệnh
khởi chạy trong `backend/Dockerfile` (`CMD ["python", "-m", "app.server"]`) — tức là
tệp quan trọng nhất khi triển khai bằng Docker. Đã chạy thử lại: hoạt động bình thường.

### A5. Lỗi dựng ảnh Docker — do tôi gây ra

Lần rà soát trước tôi xoá `backend/reset_admin.py` vì trùng chức năng với
`reset_password.py`, nhưng quên rằng `backend/Dockerfile` vẫn còn dòng:

```
COPY reset_admin.py /app/reset_admin.py
```

Hệ quả: dựng ảnh thất bại ở Step 9/13 với thông báo
`COPY failed: file not found in build context`.

**Đã sửa:** gỡ dòng đó khỏi Dockerfile, đồng thời sửa các tài liệu còn hướng dẫn
dùng `reset_admin.py`.

**Đã thêm bước kiểm tra:** rà soát toàn bộ lệnh COPY trong mọi Dockerfile, đối chiếu
với tệp thật và với `.dockerignore`. Kết quả: 0 đường dẫn hỏng.

Bài học: xoá tệp thì phải soát mọi nơi tham chiếu tới nó, không chỉ mã nguồn mà cả
Dockerfile, script và tài liệu.

## B. Những gì đang tốt

- `database.py` viết cẩn thận: WAL và busy_timeout cho SQLite, pool có pre-ping và
  recycle cho PostgreSQL, retry khi SQLite bị khoá. Có `REQUIRE_POSTGRES` để chặn
  việc vô tình rơi về SQLite ở môi trường thật.
- Bộ xử lý lỗi `SQLAlchemyError` trả 503 kèm thông báo tiếng Việt thay vì để lỗi
  rơi thành 502 khó hiểu.
- Không cache `index.html` — tránh trình duyệt trộn trang cũ với bản dựng mới.
- Cơ chế tự bổ sung cột thiếu khi khởi động vẫn hoạt động.

## C. Vấn đề gốc cần giải quyết: không dựng lại được giao diện

Hai lần phải vá bằng script ghi đè DOM đều bắt nguồn từ đây. Ba cách xử lý, xếp
theo mức độ nên chọn:

**Cách 1 — Dùng `Dockerfile.build-ui`.** Nền tảng tự dựng giao diện khi triển khai.
Không cần cài gì trên máy cá nhân. Triển khai lâu hơn khoảng 3 phút.

**Cách 2 — Cài Node.js trên máy cá nhân**, mỗi lần sửa giao diện thì chạy:
```
cd frontend && npm install && npm run build
xcopy /E /Y dist\* ..\backend\static\
```

**Cách 3 — Nhờ tôi dựng.** Gửi mã nguồn, tôi dựng và trả lại gói đã có sẵn bản dựng
đúng. Đây là cách đang dùng.

Chọn cách nào cũng được, nhưng phải bỏ hẳn thói quen vá bằng script ghi đè DOM.

## D. Kết quả chạy thử

### SQLite
12 đường dẫn công khai và 12 đường dẫn quản trị: tất cả HTTP 200.
Chẩn đoán: 16 mục kiểm tra, 0 lỗi, 0 bảng thiếu cột.

### PostgreSQL 16
Kết nối, tạo bảng, đăng nhập, ghi bản tin, nhập hàng loạt: tất cả bình thường.

### Thử cắt kết nối cơ sở dữ liệu giữa chừng

| Bước | Kết quả |
|---|---|
| CSDL bình thường | `/api/health` 200, `/api/health/ready` 200 |
| Tắt CSDL | `/api/health` **200** kèm `database: error`; `/api/health/ready` 503; `/api/news` 503 |
| Bật lại CSDL | Tự nối lại, `/api/news` 200, ghi dữ liệu 200 — không cần khởi động lại |

Ứng dụng không sập theo cơ sở dữ liệu và tự phục hồi.


---

# Bổ sung ngày 09/08/2026

## Lịch công tác: thành phần tham gia và hình thức họp

Bảng `events` có thêm 5 cột: `participants`, `meeting_type`, `meeting_info`,
`meeting_id`, `meeting_pass`. Cột tự thêm khi khởi động, lịch cũ giữ nguyên và
mặc định là họp trực tiếp.

Sáu hình thức: `truc_tiep`, `cau_truyen_hinh`, `zoom`, `google_meet`, `teams`, `khac`.

Kiểm tra dữ liệu ở cả trình duyệt lẫn máy chủ:
- Cầu truyền hình bắt buộc có IP đúng định dạng, chấp nhận kèm cổng.
- Zoom, Google Meet, Teams bắt buộc có đường dẫn bắt đầu bằng `https://`.

Trang chủ: họp trực tuyến hiện nút **Vào phòng họp**; cầu truyền hình hiện IP,
bấm một cái là sao chép.

Thêm màn hình **Quản trị → Lịch công tác tuần** để sửa từng buổi, trước đây chỉ
nhập được hàng loạt.

## Ba lỗi liên kết đã sửa

### Bản tin bấm vào không mở

Thẻ tin có `cursor: pointer` nhưng không có xử lý bấm — nhìn như bấm được mà
không có gì xảy ra.

Đã thêm trang đọc bản tin: ảnh đại diện, tiêu đề, tóm tắt, nội dung, ảnh đính kèm
bấm vào phóng to. Đóng bằng nút Đóng hoặc phím Esc. Bấm tin ở trang chủ sẽ chuyển
sang mục Truyền thông và mở đúng bài đó.

Bản tin chưa có nội dung chi tiết thì báo rõ và chỉ chỗ bổ sung, thay vì hiện trang trống.

### Tài liệu bấm vào không có gì xảy ra

Nút Tải về trỏ tới `href="#"` khi tài liệu chưa gắn tệp — bấm vào chỉ nhảy lên
đầu trang. Dữ liệu mẫu lại trỏ tất cả về `https://drive.google.com/`, mở ra
trang Drive chung chứ không phải tài liệu.

Đã sửa: bấm vào bất kỳ đâu trên dòng đều mở được tệp, có ghi nhận lượt tải.
Tài liệu chưa gắn tệp hiện nhãn **Chưa có tệp**, bấm vào báo rõ cách bổ sung.
Dữ liệu mẫu để trống đường dẫn thay vì trỏ sai.

### Lịch mẫu chưa có thông tin họp

Dữ liệu mẫu tạo trước khi có tính năng nên không có thành phần tham gia và hình
thức họp. Đã cập nhật, có đủ ba hình thức để thấy ngay cách hiển thị.


## Toàn bộ liên kết bị thiếu — đã rà soát và sửa hết

Cùng một lỗi lặp ở năm chỗ: thẻ có `cursor: pointer` nên con trỏ đổi thành bàn tay,
nhìn như bấm được, nhưng không có xử lý bấm. Người dùng bấm mà không có gì xảy ra.

| Chỗ | Trước | Sau |
|---|---|---|
| Bản tin | Bấm không có gì | Mở trang đọc: ảnh, nội dung, ảnh đính kèm phóng to được |
| Kho tài liệu | Nút trỏ `href="#"` | Bấm cả dòng mở tệp, ghi nhận lượt tải; chưa có tệp thì báo rõ |
| Góc sáng kiến | Bấm không có gì | Mở chi tiết: mô tả đầy đủ, lợi ích, người đề xuất, nút bình chọn |
| Góc văn hoá | Ảnh và sự kiện bấm không có gì | Ảnh phóng to toàn màn hình; sự kiện mở chi tiết kèm thông tin họp |
| Trao đổi nội bộ | Bấm không có gì | Mở chủ đề, xem toàn bộ câu trả lời, gửi trả lời ngay |

Các cửa sổ xem chi tiết dùng chung một khung: đóng bằng nút Đóng, bấm ra ngoài,
hoặc phím Esc; khoá cuộn nền phía sau khi đang mở.

### Bổ sung ở backend

- `GET /api/threads/{id}` — nội dung chủ đề kèm toàn bộ câu trả lời.
- `POST /api/threads/{id}/replies` — gửi trả lời, phải đăng nhập.
- `GET /api/ideas` trả thêm trường `body` để hiển thị mô tả chi tiết.

### Dữ liệu mẫu

Bổ sung nội dung chi tiết cho 4 sáng kiến và 3 câu trả lời mẫu, để thấy ngay cách
hiển thị thay vì phải tự nhập mới kiểm tra được.


## Nguyên nhân lỗi 502 — đã tìm ra và sửa

### Lỗi gốc: câu lệnh thêm cột sai kiểu trên PostgreSQL

Hàm bổ sung cột thiếu sinh ra câu lệnh:

```sql
ALTER TABLE news ADD COLUMN pinned BOOLEAN DEFAULT 0
```

SQLite chấp nhận `DEFAULT 0` cho cột boolean nên khi thử trên máy không phát hiện.
PostgreSQL từ chối:

```
column "pinned" is of type boolean but default expression is of type integer
```

Hệ quả dây chuyền: cột không được thêm → bước nạp dữ liệu tiếp theo hỏng vì thiếu
cột → ngoại lệ văng ra khỏi hàm khởi động → tiến trình không lên được → nền tảng
trả **502 cho mọi thao tác**, kể cả đăng nhập.

Đây đúng là trường hợp một lỗi nhỏ ở chỗ khó thấy làm sập toàn hệ thống.

### Đã sửa ba lớp

1. **Đúng kiểu theo hệ quản trị.** SQLite dùng `0`/`1`, PostgreSQL dùng `FALSE`/`TRUE`.
2. **Phương án dự phòng.** Nếu câu lệnh kèm giá trị mặc định vẫn bị từ chối, thử lại
   không kèm. Thà cột có giá trị rỗng còn hơn không có cột.
3. **Khởi động chịu lỗi.** Mọi bước chuẩn bị bọc trong `try/except`. Hỏng bước nào
   thì ghi lại và báo ở `/api/health`, ứng dụng vẫn khởi động được. Từ nay một bước
   lỗi không còn làm sập cả hệ thống.

### Kiểm chứng

Dựng cơ sở dữ liệu PostgreSQL kiểu bản cũ (thiếu 8 cột), rồi chạy mã nguồn mới:

| Trước khi sửa | Sau khi sửa |
|---|---|
| 2 cột không thêm được | 8/8 cột thêm thành công |
| Nạp dữ liệu mẫu thất bại | Nạp bình thường |
| Ứng dụng không khởi động được | `startup_ok: true`, không lỗi |
| Mọi thao tác trả 502 | Đăng nhập 200, các đường dẫn đều 200 |

Dữ liệu cũ trong cơ sở dữ liệu được giữ nguyên.
