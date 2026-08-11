# Triển khai lên máy chủ ảo (VPS)

Hướng dẫn này dành cho việc chạy cổng thông tin trên máy chủ thuê ngoài, có tên miền và HTTPS — thay cho cách chạy trên máy tính cá nhân.

---

## 1. Vì sao nên chuyển sang máy chủ ảo

| Vấn đề khi chạy trên máy cá nhân | Máy chủ ảo giải quyết thế nào |
|---|---|
| Tắt máy là web sập | Chạy 24/7, không phụ thuộc máy ai |
| Địa chỉ IP hay đổi | IP cố định, gắn tên miền |
| Ổ cứng hỏng là mất dữ liệu | Nhà cung cấp có sao lưu ổ đĩa |
| Trang báo `Not secure` | Có HTTPS tự động, ổ khoá xanh |
| Bạn thành người trực hệ thống | Nhà cung cấp lo phần hạ tầng |

---

## 2. Chọn nhà cung cấp

### Cấu hình cần thiết

Cổng thông tin này nhẹ. Cấu hình tối thiểu đủ dùng cho vài trăm người:

| Thành phần | Tối thiểu | Nên có |
|---|---|---|
| CPU | 2 nhân | 2–4 nhân |
| RAM | 2 GB | 4 GB |
| Ổ cứng SSD | 40 GB | 60 GB |
| Hệ điều hành | Ubuntu 22.04 | Ubuntu 24.04 |
| Băng thông | Không giới hạn hoặc từ 1 TB/tháng | |

Giá tham khảo: nhà cung cấp trong nước khoảng 200.000–500.000 đồng một tháng cho cấu hình này; nhà cung cấp nước ngoài khoảng 6–12 đô la một tháng. Giá thay đổi theo thời điểm, nên kiểm tra lại trên trang của họ.

### Nên chọn trong nước hay nước ngoài

**Khuyến nghị: chọn nhà cung cấp trong nước.**

Lý do không phải giá hay tốc độ, mà là quy định. Cổng thông tin này chứa danh sách cán bộ nhân viên, số điện thoại, số liệu điều hành sản xuất kinh doanh. Nghị định 53/2022/NĐ-CP có yêu cầu lưu trữ dữ liệu trong nước với một số loại dữ liệu. Với dữ liệu nội bộ của một đơn vị thuộc Viettel, đặt máy chủ trong nước là lựa chọn an toàn về mặt thủ tục.

Một số nhà cung cấp trong nước: Viettel IDC, VNPT Cloud, FPT Cloud, VNG Cloud, Bizfly Cloud, CMC Cloud. **Viettel IDC đáng cân nhắc trước tiên** vì cùng hệ sinh thái, thủ tục nội bộ thường thuận hơn.

Nhà cung cấp nước ngoài phổ biến: DigitalOcean, Vultr, Linode. Rẻ và dễ dùng, nhưng máy chủ đặt ngoài lãnh thổ.

### Việc phải hỏi trước khi thuê

Trước khi bỏ tiền, hỏi bộ phận an toàn thông tin hoặc hạ tầng của chi nhánh một câu:

> *"Em định thuê máy chủ ảo đặt cổng thông tin nội bộ của phòng, chứa danh sách nhân sự và số liệu điều hành. Có cần xin phép gì không, và nên thuê ở đâu?"*

Câu trả lời có thể là: đơn vị đã có sẵn máy chủ dùng chung, hoặc phải thuê qua kênh chỉ định, hoặc phải làm thủ tục đăng ký. Hỏi trước tiết kiệm hơn nhiều so với làm xong rồi phải gỡ.

---

## 3. Chuẩn bị

Ba thứ cần có trước khi bắt đầu:

1. **Máy chủ ảo** đã tạo, biết địa chỉ IP và mật khẩu tài khoản `root` hoặc tài khoản có quyền `sudo`.
2. **Tên miền** đã có (ví dụ `vcchcm.com`), vào được trang quản lý tên miền.
3. **Bộ mã nguồn** `portal-cnct` trên máy tính của bạn.

---

## 4. Trỏ tên miền về máy chủ

Vào trang quản lý tên miền, tạo bản ghi:

| Loại | Tên | Giá trị | TTL |
|---|---|---|---|
| A | `@` | Địa chỉ IP máy chủ | 300 |
| A | `www` | Địa chỉ IP máy chủ | 300 |

Chờ 5–30 phút. Kiểm tra bằng cách mở Command Prompt trên máy bạn và gõ:

```
nslookup vcchcm.com
```

Nếu hiện đúng IP máy chủ là được.

---

## 5. Chép mã nguồn lên máy chủ

Trên máy tính của bạn, mở PowerShell tại thư mục chứa `portal-cnct`:

```powershell
scp -r portal-cnct root@<IP-máy-chủ>:~/
```

Nhập mật khẩu khi được hỏi. Nếu máy Windows không có lệnh `scp`, dùng phần mềm WinSCP hoặc FileZilla để kéo thả thư mục lên.

---

## 6. Cài đặt

Đăng nhập vào máy chủ:

```
ssh root@<IP-máy-chủ>
```

Rồi chạy một lệnh duy nhất:

```bash
cd portal-cnct
bash deploy-vps.sh
```

Script sẽ tự làm những việc sau:

1. Cài Docker nếu chưa có *(nếu vừa cài, script bảo bạn đăng xuất và đăng nhập lại rồi chạy lần nữa — đó là bình thường)*
2. Hỏi tên miền và email quản trị
3. Sinh mật khẩu cơ sở dữ liệu và khoá bí mật ngẫu nhiên
4. Kiểm tra tên miền đã trỏ đúng chưa, cảnh báo nếu chưa
5. Mở cổng 80 và 443 trên tường lửa
6. Dựng và khởi chạy toàn bộ hệ thống
7. Xin chứng chỉ HTTPS từ Let's Encrypt và kiểm tra kết quả

Lần đầu mất khoảng 5–10 phút. Xong sẽ hiện:

```
  CÀI ĐẶT THÀNH CÔNG

  Cổng thông tin: https://vcchcm.com
  Tài liệu API  : https://vcchcm.com/docs
```

Mở trình duyệt vào địa chỉ đó — thanh địa chỉ sẽ có ổ khoá, không còn `Not secure`.

---

## 7. Làm ngay sau khi cài xong

- [ ] Đăng nhập `admin` / `viettel@2026`
- [ ] Vào **Quản trị → Quản lý tài khoản**, đổi mật khẩu cả ba tài khoản mặc định
- [ ] Đặt lịch sao lưu tự động:

```bash
crontab -e
# thêm dòng (sửa đường dẫn cho đúng):
0 2 * * * cd /root/portal-cnct && bash backup.sh >> backup.log 2>&1
```

- [ ] Vào **Quản trị → Quản lý ứng dụng**, điền đường dẫn thật cho GNOC, NIMS, Portal Viettel
- [ ] Thay dữ liệu mẫu bằng dữ liệu thật của đơn vị

---

## 8. Bảo mật máy chủ

Máy chủ đặt ngoài Internet nên bị dò quét liên tục. Bốn việc nên làm:

**Đổi mật khẩu SSH sang khoá.** An toàn hơn mật khẩu rất nhiều:

```bash
# Trên máy tính của bạn
ssh-keygen -t ed25519
ssh-copy-id root@<IP-máy-chủ>
```

Sau đó tắt đăng nhập bằng mật khẩu:

```bash
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

**Bật tường lửa, chỉ mở ba cổng:**

```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

**Cài fail2ban** để tự chặn địa chỉ dò mật khẩu:

```bash
sudo apt install -y fail2ban
```

**Cập nhật hệ thống hằng tháng:**

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 9. Sao lưu ra ngoài máy chủ

Sao lưu nằm cùng máy chủ thì máy chủ hỏng là mất cả hai. Nên chép ra chỗ khác.

Tải bản sao lưu về máy tính của bạn:

```powershell
scp root@<IP-máy-chủ>:~/portal-cnct/backups/*.sql.gz D:\backup-portal\
```

Hoặc trên máy chủ, cài `rclone` để tự đẩy lên Google Drive:

```bash
sudo apt install -y rclone
rclone config          # làm theo hướng dẫn để nối với Google Drive
# rồi thêm vào cuối backup.sh:
# rclone copy ./backups gdrive:portal-backup
```

---

## 10. Lệnh quản lý thường dùng

Lưu ý: trên VPS phải kèm `-f docker-compose.vps.yml` vào mọi lệnh.

| Việc | Lệnh |
|---|---|
| Xem trạng thái | `docker compose -f docker-compose.vps.yml ps` |
| Xem lỗi backend | `docker compose -f docker-compose.vps.yml logs -f backend` |
| Xem lỗi chứng chỉ HTTPS | `docker compose -f docker-compose.vps.yml logs caddy` |
| Khởi động lại | `docker compose -f docker-compose.vps.yml restart` |
| Cập nhật sau khi sửa mã | `docker compose -f docker-compose.vps.yml up -d --build` |
| Dừng hệ thống | `docker compose -f docker-compose.vps.yml down` |
| Đặt lại mật khẩu | `docker compose -f docker-compose.vps.yml exec backend python reset_password.py admin MatKhauMoi2026` |

---

## 11. Sự cố thường gặp

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| Vào tên miền không lên trang | Tên miền chưa trỏ, hoặc chưa lan truyền xong | `nslookup <tên miền>` xem đã đúng IP chưa, chờ thêm |
| Vẫn `Not secure`, không có ổ khoá | Caddy chưa xin được chứng chỉ | `docker compose -f docker-compose.vps.yml logs caddy` xem lý do. Thường do cổng 80 bị chặn |
| Trang lên nhưng đăng nhập báo lỗi | Backend chưa chạy | Mở `https://<tên miền>/api/health`. Không thấy `{"status":"ok"}` thì xem log backend |
| Báo hết dung lượng | Ảnh nhật ký và Docker tích tụ | `docker system prune -a` và xoá bản sao lưu cũ |
| Let's Encrypt báo vượt giới hạn | Xin chứng chỉ quá nhiều lần trong tuần | Chờ tới tuần sau, hoặc đổi sang tên miền phụ để thử |

---

## 12. Chi phí ước tính một năm

| Khoản | Ước tính |
|---|---|
| Máy chủ ảo 2 nhân, 4 GB | 2,4 – 6 triệu đồng |
| Tên miền `.com` | 250.000 – 350.000 đồng |
| Chứng chỉ HTTPS | Miễn phí (Let's Encrypt) |
| Phần mềm | Miễn phí (mã nguồn mở) |

Con số này để bạn ước lượng khi lập tờ trình. Giá cụ thể phải lấy báo giá từ nhà cung cấp tại thời điểm mua.
