# Cổng thông tin nội bộ
## Phòng Vận hành khai thác - Chi nhánh Công trình Viettel Hồ Chí Minh

Trang chủ dùng chung cho cán bộ, nhân viên chi nhánh: tin tức, ứng dụng, tài liệu, số liệu điều hành, danh bạ, sáng kiến và trao đổi nội bộ.

Tài liệu này viết cho người **chưa từng triển khai phần mềm**. Cứ làm tuần tự từ trên xuống.

---

## 1. Bạn cần chuẩn bị gì

| Việc cần có | Ghi chú |
|---|---|
| Một máy chủ (VPS hoặc máy chủ nội bộ) | Ubuntu 22.04 trở lên, tối thiểu 2 nhân CPU, 4 GB RAM, 40 GB ổ cứng |
| Quyền quản trị máy chủ đó | Tài khoản đăng nhập được bằng SSH |
| Một tên miền nội bộ | Ví dụ `portal.cncthcm.local`, nhờ bộ phận hạ tầng trỏ về máy chủ |
| Người phụ trách nội dung | Một cán bộ cập nhật tin tức, tài liệu hằng tuần |

Nếu chưa có máy chủ, bạn vẫn chạy thử được ngay trên máy tính cá nhân — xem Mục 3.

---

## 2. Hệ thống gồm những phần nào

Ba phần chạy độc lập, ghép lại thành cổng thông tin:

```
Người dùng  →  frontend (giao diện)  →  backend (xử lý)  →  db (lưu trữ)
                React + Tailwind        FastAPI (Python)    PostgreSQL
```

- **frontend** — những gì nhìn thấy trên màn hình.
- **backend** — nơi lấy và ghi dữ liệu, kiểm tra quyền đăng nhập.
- **db** — kho lưu trữ toàn bộ tin bài, tài liệu, danh bạ, số liệu.

Bạn không cần hiểu sâu ba phần này. Công cụ Docker sẽ dựng cả ba bằng một lệnh.

---

## 3. Chạy thử trong 10 phút

### Bước 1 — Cài Docker

Trên Ubuntu, chạy lần lượt:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```

Đăng xuất và đăng nhập lại để quyền có hiệu lực. Kiểm tra:

```bash
docker --version
```

Có hiện số phiên bản là được. (Trên Windows hoặc macOS thì cài **Docker Desktop** từ trang chủ Docker.)

### Bước 2 — Lấy mã nguồn về máy chủ

Chép cả thư mục `portal-cnct` lên máy chủ, rồi vào thư mục đó:

```bash
cd portal-cnct
```

### Bước 3 — Tạo file cấu hình

```bash
cp .env.example .env
```

Mở file `.env` và sửa hai dòng quan trọng:

- `POSTGRES_PASSWORD` — đặt mật khẩu riêng, không để mặc định.
- `SECRET_KEY` — sinh chuỗi ngẫu nhiên bằng lệnh `openssl rand -hex 32` rồi dán vào.

### Bước 4 — Khởi chạy

**Cách nhanh nhất — chạy một lệnh duy nhất:**

```bash
bash deploy.sh
```

Script tự kiểm tra Docker, tự sinh mật khẩu và khoá bí mật, tự dựng hệ thống, tự kiểm tra kết quả rồi in ra địa chỉ truy cập. Nếu cổng 80 đang bận, script tự chuyển sang cổng 8080.

**Cách thủ công (nếu muốn tự kiểm soát từng bước):**

```bash
docker compose up -d --build
```

Lần đầu mất khoảng 3–5 phút để tải và dựng. Xong rồi kiểm tra:

```bash
docker compose ps
```

Cả ba dòng `portal-db`, `portal-backend`, `portal-frontend` phải ở trạng thái `running`.

### Bước 5 — Mở thử

- Cổng thông tin: `http://<địa-chỉ-máy-chủ>`
- Tài liệu API (dành cho người kỹ thuật): `http://<địa-chỉ-máy-chủ>:8000/docs`

Tài khoản mẫu để đăng nhập thử:

| Tài khoản | Mật khẩu | Quyền |
|---|---|---|
| `admin` | `viettel@2026` | Quản trị viên — vào được cả 9 mục Quản trị |
| `luongdv` | `viettel@2026` | Biên tập viên — được cấp sẵn Tin tức, Tài liệu; bản local cũng cấp Quản lý nhân viên để thử nghiệm |
| `linhbn` | `viettel@2026` | Nhân viên — chỉ xem và bình chọn |

### Khu quản trị

Đăng nhập bằng `admin`, menu **⚙️ Quản trị** hiện ở cuối thanh bên trái với 9 mục:

| Mục | Sửa được gì |
|---|---|
| Quản lý bản tin | Tiêu đề, nội dung, ảnh đại diện, người đăng, ngày đăng, chuyên mục, tin nổi bật, ghim trang chủ, trạng thái hiển thị |
| Quản lý thông báo | Nội dung dải đỏ khẩn trên trang chủ, bật/tắt |
| Quản lý banner | Ảnh hoặc nền màu, đường dẫn, thứ tự, bật/tắt |
| Thông điệp Giám đốc | Họ tên, chức danh, nội dung thông điệp |
| Quản lý ứng dụng | Tên, mô tả, **đường dẫn thật** của GNOC, NIMS, Portal Viettel… |
| Quản lý tài liệu | Tên, số hiệu, nhóm, đường dẫn tệp, từ khoá tìm kiếm |
| Quản lý nhân viên | Họ tên, chức vụ, đơn vị, điện thoại, **ngày sinh** |
| Góc văn hoá | Sự kiện của đơn vị. Sinh nhật lấy tự động từ Quản lý nhân viên |
| Nhập dữ liệu hàng loạt | Thêm/sửa nhiều dòng cùng lúc: tài khoản, nhân viên, lịch tuần, số liệu. Có tệp mẫu Excel |
| Nguồn dữ liệu Sheet | Nối với Google Sheet để số liệu tự cập nhật |
| Quản lý tài khoản | Tạo tài khoản, phân quyền, đặt lại mật khẩu, xoá tài khoản *(chỉ quản trị viên)* |
| Kiểm tra hệ thống | Chạy thử từng phần, chỉ ra chỗ hỏng, tự bổ sung cột thiếu *(chỉ quản trị viên)* |
| Cấu hình website | Tên cổng, người phụ trách, số điện thoại, tải tệp cơ sở dữ liệu *(chỉ quản trị viên)* |

### Ba mức quyền

| Quyền | Làm được gì |
|---|---|
| **Quản trị viên** (`admin`) | Toàn quyền, kể cả quản lý tài khoản và cấu hình website |
| **Biên tập viên** (`editor`) | Mặc định quản lý bản tin và tài liệu. Quản trị viên cấp riêng từng mục menu cùng quyền Xem/Thêm/Sửa/Xóa; không thấy mục Quản lý tài khoản và Cấu hình website |
| **Nhân viên** (`staff`) | Chỉ xem, bình chọn sáng kiến, đăng bài thảo luận |

### Tạo tài khoản cho anh em

Đăng nhập `admin` → **Quản trị → Quản lý tài khoản → Tạo tài khoản**. Điền tên đăng nhập
(nên đặt theo tên viết tắt, ví dụ `luongdv`), mật khẩu ban đầu tối thiểu 8 ký tự, chọn quyền.
Báo mật khẩu cho người dùng và nhắc họ vào **Đổi mật khẩu** ở góc trái dưới để tự đặt lại.

Nếu ai quên mật khẩu, quản trị viên bấm nút chìa khoá ở dòng tài khoản đó để đặt lại.

Hệ thống không cho phép xoá hoặc hạ quyền quản trị viên cuối cùng, để tránh khoá chính mình ra ngoài.

> **Đổi ngay ba mật khẩu này trước khi cho anh em vào dùng.**

---

## 3-PaaS. Chạy trên nền tảng hosting (Mắt Bão Vibe Host, Render, Railway…)

Loại nền tảng chỉ cho triển khai một ứng dụng, không có SSH. Bộ mã nguồn đã đóng gói
sẵn thành **một dịch vụ duy nhất** — một tiến trình vừa phát giao diện, vừa xử lý
dữ liệu, vừa lưu trữ. Không cần tạo database riêng.

- Nền tảng hỗ trợ Docker: trỏ vào `./Dockerfile` ở thư mục gốc.
- Nền tảng chạy Python: lệnh cài `pip install -r backend/requirements.txt`,
  lệnh chạy `bash start.sh`.

Chi tiết và các điểm phải hỏi nhà cung cấp: đọc `docs/HUONG-DAN-MATBAO.md`.

---

## 3-VPS. Chạy trên máy chủ ảo, có tên miền và HTTPS

Đây là cách khuyên dùng khi đưa vào sử dụng thật:

```bash
cd portal-cnct
bash deploy-vps.sh
```

Script hỏi tên miền và email, tự cài Docker, tự sinh mật khẩu, tự xin chứng chỉ HTTPS
từ Let's Encrypt và tự gia hạn. Chỉ Caddy mở ra Internet; cơ sở dữ liệu và backend
nằm kín trong mạng nội bộ của Docker.

Hướng dẫn đầy đủ — chọn nhà cung cấp, trỏ tên miền, bảo mật máy chủ, chi phí:
đọc `docs/HUONG-DAN-VPS.md`.

---

## 3a. Chạy trên máy tính cá nhân (Windows)

Chưa có máy chủ vẫn triển khai được. Vào thư mục `windows`, nhấn đúp `1-CAI-DAT-LAN-DAU.bat` rồi `2-KHOI-DONG.bat`. Không cần Docker, không cần PostgreSQL — chỉ cần Python.

Dữ liệu nằm gọn tại thư mục `data\portal.db` cạnh thư mục `windows` (đổi được sang ổ khác, xem `windows/3-CAU-HINH.txt`). Sao lưu bằng cách chép file đó đi, hoặc nhấn đúp `3-SAO-LUU.bat`.

Hướng dẫn chi tiết và phần cân nhắc nên hay không nên: đọc `windows/HUONG-DAN-CHAY-TREN-MAY-TINH.md`.

---

## 3b. Xem trước ngay, không cần cài gì

Kèm theo bộ bàn giao có file **`cong-thong-tin-noi-bo.html`**. Nhấn đúp vào file là mở được toàn bộ giao diện chín phân hệ trên trình duyệt, không cần máy chủ, không cần Docker, không cần mạng.

Dùng file này để:

- Trình diễn trước Ban Giám đốc khi chưa có máy chủ.
- Gửi cho các phòng, trung tâm xem và góp ý giao diện.
- Kiểm tra hiển thị trên điện thoại.

Lưu ý: bản này chạy trên dữ liệu mẫu cố định. Đăng tin, bình chọn hay đăng sáng kiến chỉ hiện tạm trên máy đang xem, không lưu lại. Muốn lưu thật thì phải chạy đủ hệ thống theo Mục 3.

---

## 4. Việc phải làm trước khi đưa vào dùng thật

Đây là danh sách kiểm tra. Làm hết mới công bố cho toàn chi nhánh.

- [ ] Đổi `POSTGRES_PASSWORD` và `SECRET_KEY` trong file `.env`.
- [ ] Đổi mật khẩu ba tài khoản mẫu ở trên.
- [ ] Xoá dữ liệu mẫu, nhập dữ liệu thật (xem Mục 5).
- [ ] Điền đúng đường dẫn GNOC, NIMS, Portal Viettel và các phần mềm tự phát triển (Mục 6).
- [ ] Nhờ hạ tầng trỏ tên miền nội bộ về máy chủ.
- [ ] Bật sao lưu cơ sở dữ liệu hằng ngày (Mục 8).
- [ ] Cài trang này làm trang chủ trên trình duyệt của các máy trạm.

---

## 5. Nhập dữ liệu thật

Dữ liệu mẫu nằm trong `backend/app/seed.py`, chỉ tự nạp **một lần khi cơ sở dữ liệu còn trống**.

Cách làm sạch và nhập lại từ đầu:

```bash
docker compose down -v      # xoá luôn dữ liệu cũ
docker compose up -d        # dựng lại, nạp seed mới
```

Có hai cách nhập dữ liệu thật:

**Cách 1 — dùng khu Quản trị (khuyên dùng).** Đăng nhập `admin`, vào ⚙️ Quản trị, sửa trực tiếp trên giao diện. Không cần biết lập trình.

**Cách 2 — sửa file seed.** Mở `backend/app/seed.py`, thay danh sách nhân sự, tài liệu, ứng dụng, rồi chạy lại hai lệnh ở trên. Phù hợp khi cần nhập số lượng lớn ngay từ đầu.

---

## 6. Cập nhật đường dẫn ứng dụng

Trong `backend/app/seed.py`, phần `apps_raw`, các dòng có `"#"` là chỗ cần điền đường dẫn thật:

```python
("GNOC", "Giám sát và điều hành mạng lưới", "#", "Vận hành", "#EA0A2A"),
                                             ↑ thay bằng địa chỉ thật
```

Hỏi bộ phận kỹ thuật để lấy đúng địa chỉ nội bộ của GNOC, NIMS, Portal Viettel và các phần mềm chi nhánh tự phát triển.

---

## 7. Các lệnh hay dùng

| Việc | Lệnh |
|---|---|
| Xem trạng thái | `docker compose ps` |
| Xem nhật ký lỗi backend | `docker compose logs -f backend` |
| Khởi động lại | `docker compose restart` |
| Dừng hệ thống | `docker compose down` |
| Dựng lại sau khi sửa mã | `docker compose up -d --build` |

---

## 8. Sao lưu dữ liệu

Đã có sẵn hai script:

```bash
bash backup.sh                                    # sao lưu ngay
bash restore.sh backups/portal-2026-08-08-0200.sql.gz   # phục hồi
```

`backup.sh` nén file và tự xoá bản cũ hơn 30 ngày. `restore.sh` hỏi xác nhận trước khi ghi đè.

Đặt lịch chạy tự động lúc 2 giờ sáng hằng ngày:

```bash
crontab -e
# thêm dòng (thay bằng đường dẫn thật):
0 2 * * * cd /home/viettel/portal-cnct && bash backup.sh >> backup.log 2>&1
```

---

## 8b. Quên mật khẩu, không đăng nhập được

Không cần xoá dữ liệu. Có công cụ đặt lại mật khẩu:

```bash
cd backend
python reset_password.py --list                    # xem các tài khoản đang có
python reset_password.py admin MatKhauMoi2026      # đặt lại mật khẩu
```

Trên Windows: nhấn đúp `windows\4-QUEN-MAT-KHAU.bat`, làm theo hướng dẫn trên màn hình.

Nếu chạy bằng Docker:

```bash
docker compose exec backend python reset_password.py admin MatKhauMoi2026
```

Lỡ xoá hết tài khoản quản trị thì thêm `--create` vào cuối lệnh để tạo mới.

---

## 8c. Màn hình quản trị báo lỗi 502

Nguyên nhân thường gặp: cơ sở dữ liệu được tạo từ bản cũ, thiếu cột mà mã nguồn mới cần.
Khi đó một vài màn hình hỏng còn các màn hình khác vẫn chạy bình thường.

Từ bản này, hệ thống **tự bổ sung cột còn thiếu mỗi lần khởi động**. Chỉ thêm cột,
không xoá gì, không mất dữ liệu.

Nếu vẫn gặp lỗi, vào **Quản trị → Kiểm tra hệ thống**. Màn hình chạy thử từng phần
và chỉ rõ phần nào hỏng kèm thông báo lỗi thật, thay vì để bạn đoán. Có nút bổ sung
cột còn thiếu ngay tại đó.

---

## 9. Sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Mở trang thấy trắng | Trình duyệt còn nhớ bản cũ | Nhấn `Ctrl + F5` để tải lại |
| Trang hiện nhưng dữ liệu là số liệu mẫu | Backend chưa chạy | `docker compose logs backend` để xem lỗi |
| Đăng nhập báo sai mật khẩu | Quên mật khẩu, hoặc dữ liệu tạo từ bản cũ | Chạy `cd backend && python reset_password.py admin MatKhauMoi2026` |
| Cổng 80 đã bị chiếm | Máy chủ có sẵn web server khác | Sửa `docker-compose.yml`, đổi `"80:80"` thành `"8080:80"` |
| Tìm kiếm không ra kết quả | Gõ dưới 2 ký tự | Hệ thống chỉ tìm từ 2 ký tự trở lên |

---

## 10. Lộ trình bốn giai đoạn

| Giai đoạn | Nội dung | Thời gian dự kiến |
|---|---|---|
| 1 | Dựng cổng thông tin, đăng nhập, trang chủ | Tuần 1–2 |
| 2 | Truyền thông nội bộ và trung tâm ứng dụng | Tuần 3–4 |
| 3 | Dashboard KPI, WO, xăng dầu | Tuần 5–7 |
| 4 | Danh bạ, kho tài liệu, sáng kiến, trao đổi | Tuần 8–10 |

Bản mã nguồn này đã dựng sẵn khung của cả bốn giai đoạn. Việc còn lại chủ yếu là **thay dữ liệu mẫu bằng dữ liệu thật** và **nối vào các hệ thống có sẵn**.

---

## 11. Cấu trúc thư mục

```
portal-cnct/
├── deploy-vps.sh          Cài lên máy chủ ảo, kèm HTTPS tự động
├── docker-compose.vps.yml Cấu hình cho máy chủ ảo
├── Caddyfile              Cấu hình HTTPS
├── deploy.sh              Cài đặt trong mạng nội bộ, không cần tên miền
├── windows/               Bộ file chạy trên máy tính Windows
├── Dockerfile             Đóng gói một dịch vụ duy nhất (dùng cho hosting)
├── start.sh               Lệnh khởi chạy cho nền tảng chỉ chạy Python
├── docs/HUONG-DAN-VPS.md  Hướng dẫn triển khai máy chủ ảo
├── docs/HUONG-DAN-MATBAO.md  Hướng dẫn cho nền tảng hosting
├── backup.sh              Sao lưu cơ sở dữ liệu
├── restore.sh             Phục hồi từ bản sao lưu
├── docker-compose.yml     Khai báo ba thành phần chạy cùng nhau
├── .env.example           Mẫu file cấu hình, chép thành .env
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt   Thư viện Python cần cài
│   └── app/
│       ├── main.py        Toàn bộ đường dẫn API
│       ├── models.py      Mô tả các bảng dữ liệu
│       ├── database.py    Kết nối PostgreSQL
│       ├── auth.py        Đăng nhập và phân quyền
│       └── seed.py        Dữ liệu mẫu ban đầu
└── frontend/
    ├── Dockerfile
    ├── nginx.conf         Cấu hình phục vụ trang
    ├── package.json       Thư viện JavaScript cần cài
    └── src/
        ├── App.jsx        Toàn bộ giao diện chín phân hệ
        ├── api.js         Lớp gọi API và dữ liệu dự phòng
        └── main.jsx       Điểm khởi động
```

---

## 12. Cần giúp thêm

Ghi lại lỗi bạn gặp kèm kết quả của lệnh `docker compose logs backend` — đó là thông tin cần thiết để tìm nguyên nhân.
