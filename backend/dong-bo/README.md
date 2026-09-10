# Số liệu Dashboard đi kèm mã nguồn

Cơ sở dữ liệu thật (`data/*.db`, hoặc Postgres của bản chạy thật) **không** nằm
trong Git: nó chứa danh bạ nhân viên, tài khoản đăng nhập và nhật ký thao tác.
Thư mục này giữ phần **số liệu Dashboard** — không có tên, số điện thoại hay
email của ai — để Git mang theo được cả dữ liệu chứ không chỉ mã nguồn, và để
mỗi lần cập nhật số liệu đều để lại dấu vết trong lịch sử Git.

## Có gì trong đây

| Tệp | Nội dung |
|---|---|
| `so-lieu-dashboard.csv` | Toàn bộ chỉ số Dashboard: KPI, tiền phạt, doanh thu, Cell\*h, Ksub\*min, XLCS, TKM, rời mạng… |
| `dinh-bien-trung-tam.csv` | Định biên và số thiếu theo trung tâm |
| `danh-muc-trung-tam.csv` | Danh mục mã trung tâm (THA, CHP, DTG…) |
| `danh-muc-dau-viec.csv` | Danh mục đầu việc kỹ thuật |
| `danh-muc-hang-muc.csv` | Danh mục hạng mục tiến độ |
| `csdl-ha-tang.csv` | Số liệu CSDL hạ tầng theo cụm |

## Dùng thế nào

```bash
python scripts/xuat_so_lieu.py    # CSDL  -> các tệp trong thư mục này
python scripts/nap_so_lieu.py     # các tệp trong thư mục này -> CSDL
```

Nạp lại nhiều lần vẫn ra một kết quả (ghi đè theo khoá nhận diện của từng bảng),
và không xoá dữ liệu nào không có trong tệp.

Khi khởi động, nếu bảng số liệu còn trống thì hệ thống **tự nạp** thư mục này —
máy mới clone repo về là có sẵn số liệu. Máy đã có dữ liệu thì bước đó tự bỏ qua,
không bao giờ ghi đè.

## Quy tắc bắt buộc

Repo này đang ở chế độ **công khai**. Chỉ được thêm bảng vào đây sau khi soát lại
**từng cột** và chắc chắn không có thông tin cá nhân. Các bảng cố ý để ngoài:
hồ sơ nhân viên, tài khoản đăng nhập, lịch trực (có số điện thoại của 287 người),
nhật ký thao tác, diễn đàn, sáng kiến, tệp tải lên, và tiến độ mảng kỹ thuật
(khoá nhận diện của nó gồm cả tên người phụ trách).

Danh sách bảng được đồng bộ khai báo tại `backend/app/dongbo.py`.

Thư mục nằm trong `backend/` chứ không phải gốc repo vì nền tảng triển khai
dựng image từ đúng thư mục `backend/` — để ở ngoài thì tệp không lên máy chủ.
