# Báo cáo rà soát tổng thể — bản 2026-08-09.v8

## Cách rà soát

Không đọc lướt mà đối chiếu bằng công cụ:

1. Trích toàn bộ đường dẫn giao diện gọi tới, đối chiếu với danh sách đường dẫn
   máy chủ thực sự có (lấy từ đặc tả OpenAPI). Tìm hai chiều: gọi mà không có,
   và có mà không ai gọi.
2. Gọi thử từng đường dẫn với ba mức quyền, đối chiếu mã trả về với mức mong đợi.
3. Chạy bảy luồng dữ liệu đầu-cuối: tạo bản ghi ở màn hình quản trị rồi kiểm tra
   nó có hiện đúng chỗ ngoài trang công khai không, xoá đi có rã liên kết không.
4. Rà những chỗ giao diện còn vẽ dữ liệu cứng thay vì gọi máy chủ.

---

## Lỗi nghiêm trọng đã tìm ra

### Dashboard không hề gọi máy chủ

Đây là chỗ hời hợt nhất. Cả bảy bảng số liệu đều vẽ dữ liệu cứng trong mã nguồn.
Đường dẫn `/api/dashboard/{bảng}` tồn tại ở máy chủ nhưng **không dòng nào trong
giao diện gọi tới**. Nghĩa là dù nhập số thật hay nối Google Sheet, biểu đồ vẫn
hiện số cũ.

**Đã viết lại toàn bộ.** Giờ mỗi bảng gọi máy chủ, ưu tiên theo thứ tự:
Google Sheet → cơ sở dữ liệu → số liệu mẫu. Trên mỗi biểu đồ có nhãn ghi rõ số
đang đến từ đâu. Khi chưa có số thật, hiện ghi chú màu vàng chỉ đúng chỗ nhập số.

Bổ sung bảng số liệu chi tiết dưới biểu đồ, vì nhìn biểu đồ không đọc được con số
chính xác.

### Ô chỉ số trang chủ luôn là số mẫu

Sáu ô lớn trên trang chủ chỉ lấy số khi đã nối Google Sheet. Chưa nối thì hiện
68%, 1.28%, 0đ vĩnh viễn — trông như số thật.

**Đã sửa:** khi chưa nối Sheet, máy chủ tự tính từ bảng số liệu trong cơ sở dữ liệu.
Chỉ tiêu nào không có số thì bỏ ô đó, không bịa. Không có ô nào thì giao diện hiện
số mẫu kèm ghi chú rõ ràng.

### Lịch trống hiện lịch giả

Hôm nào không có lịch, trang chủ vẫn hiện năm việc mẫu. Người xem tưởng có lịch thật.

**Đã sửa:** máy chủ trả lời mà không có lịch thì hiện đúng là trống, kèm câu chỉ
chỗ nhập. Chỉ dùng lịch mẫu khi chưa gọi được máy chủ, để trang không rỗng lúc xem thử.

### Cuộc thi ảnh dùng dữ liệu cứng

Bốn tác phẩm nằm trong mã nguồn, quản trị viên không sửa được.

**Đã sửa:** lấy từ album ảnh, chọn các mục thuộc album có chữ "thi ảnh". Ảnh bấm
vào phóng to. Chưa có thì báo trống và chỉ chỗ thêm.

### Khai báo trùng ở hai nơi

Danh sách hình thức họp và ba mức quyền được khai báo cả ở máy chủ lẫn giao diện.
Sửa một nơi quên nơi kia là lệch mà không ai biết.

**Đã sửa:** giao diện đối chiếu với máy chủ. Lệch thì hiện cảnh báo ngay trong
màn hình đang dùng.

---

## Kết quả kiểm thử

### Đường dẫn

| Nhóm | Kết quả |
|---|---|
| Công khai (gồm 7 bảng Dashboard) | 24/24 trả 200 |
| Quản trị | 17/17 trả 200 |
| Gọi mà máy chủ không có | 0 |
| Có mà không ai gọi | 0 (trừ `/api/health/ready` dành cho giám sát) |

### Phân quyền

| Tình huống | Mong đợi | Kết quả |
|---|---|---|
| Chưa đăng nhập xem tài khoản | 401 | đạt |
| Nhân viên xem tài khoản | 403 | đạt |
| Biên tập viên xem tài khoản | 403 | đạt |
| Biên tập viên xem bản tin | 200 | đạt |
| Nhân viên xem bản tin | 403 | đạt |
| Biên tập viên xem cấu hình | 403 | đạt |

### Bảy luồng dữ liệu đầu-cuối

| Luồng | Kết quả |
|---|---|
| Tạo nhân viên có ngày sinh → hiện ở mục Sinh nhật trang chủ | đạt |
| Tạo bản tin ghim → lên đầu trang chủ; tắt hiển thị → biến mất | đạt |
| Tạo lịch công tác → hiện trang chủ kèm thành phần và đường dẫn họp | đạt |
| Nhập hàng loạt số liệu → kỳ mới xuất hiện trên Dashboard | đạt |
| Tạo tài khoản → đăng nhập được, đúng quyền | đạt |
| Thêm ảnh vào album → hiện ở trang công khai | đạt |
| Xoá nhân viên → mục Sinh nhật giảm đúng một; xoá lịch → tương tự | đạt |

### Tìm kiếm không dấu

Gõ `co dien`, `truyen dan`, `vo tuyen`, `cap quang`, `tu nguon`, `vung phu`,
`ca truc`, `xang dau` đều tìm ra đúng tài liệu.

### Chẩn đoán hệ thống

16 mục kiểm tra, 0 lỗi, 0 bảng thiếu cột.
`build 2026-08-09.v8 · api 6 · startup_ok true · database ok`

---

## Chỗ vẫn dùng dữ liệu cứng, và lý do

| Chỗ | Lý do giữ nguyên |
|---|---|
| Tám giá trị cốt lõi văn hoá Viettel | Là hằng số, không thay đổi theo đơn vị |
| Dữ liệu mẫu cho biểu đồ | Chỉ dùng khi chưa có số thật, có nhãn ghi rõ |
| Dữ liệu dự phòng khi mất kết nối | Để trang không trắng lúc máy chủ chưa sẵn sàng |
| Thời tiết trên trang chủ | Chưa nối dịch vụ thời tiết, sẽ làm ở bước sau |

---

## Việc chưa làm, để bạn biết trước

1. **Thời tiết trang chủ** vẫn là số cố định. Cần nối một dịch vụ thời tiết thật.
2. **Bình chọn cuộc thi ảnh** lưu tại máy người dùng, chưa cộng dồn ở máy chủ.
3. **Quản lý tệp đã tải lên** có đường dẫn ở máy chủ nhưng chưa có màn hình.
   Ảnh cũ không dùng nữa sẽ tồn lại trong thư mục dữ liệu.
4. **Bản tin chưa có trình soạn thảo định dạng.** Nội dung là văn bản thuần,
   xuống dòng giữ nguyên nhưng không in đậm, gạch đầu dòng được.


---

# Chốt phiên bản — bản 2026-08-09.v8

## Thống nhất số phiên bản

Rà toàn bộ nơi có ghi số phiên bản, tìm ra một chỗ lệch nghiêm trọng:

**Ba tệp `docker-compose` ghi đè biến `PORTAL_BUILD` bằng chuỗi cũ**
(`STABLE-PG-ICONS-20260808`). Triển khai bằng Docker là máy chủ báo chuỗi cũ,
chân trang hiện LỆCH BẢN, dù mã nguồn hoàn toàn đúng.

Đã bỏ dòng ghi đè ở cả ba tệp. Từ nay số phiên bản chỉ nằm ở hai nơi:

| Nơi | Giá trị |
|---|---|
| `frontend/src/build.js` | `BUILD_ID = "2026-08-09.v8"` |
| `backend/app/main.py` | `PORTAL_BUILD = "2026-08-09.v8"` |
| `backend/app/main.py` | `API_VERSION = 6` |
| `frontend/src/api.js` | `API_CAN_CO = 6` |

## Công cụ tự kiểm tra

Thêm `kiem-tra-truoc-khi-dong-goi.py`. Chạy trước mỗi lần phát hành:

```
python3 kiem-tra-truoc-khi-dong-goi.py
```

Kiểm tra sáu nhóm, đúng những lỗi đã từng gây sự cố thật:

1. Số phiên bản hai phía có trùng nhau không
2. `docker-compose` có ghi đè số phiên bản không
3. Bản dựng trong `backend/static` có cũ hơn mã nguồn không
4. `Dockerfile` có chép tệp không tồn tại không *(lỗi này từng làm hỏng lần dựng v4)*
5. Tệp rác lọt vào gói
6. Giao diện có gọi đường dẫn máy chủ không có không

**Ngay lần chạy đầu, công cụ bắt được một lỗi tôi đã bỏ sót:** `frontend/index.html`
vẫn còn dòng nạp `portal-home.js` — tệp vá DOM đã xoá từ lâu. Trước đó tôi chỉ gỡ ở
bản dựng chứ không gỡ ở mã nguồn, nên mỗi lần dựng lại nó quay về. Đã sửa tận gốc.

## Kiểm thử vận hành cuối

Chạy song song hai tiến trình, một dùng SQLite một dùng PostgreSQL 16, trên cùng
bộ mã nguồn:

| | SQLite | PostgreSQL 16 |
|---|---|---|
| Đường dẫn công khai | 22/22 | 22/22 |
| Đường dẫn quản trị | 16/16 | 16/16 |
| Chẩn đoán | 16 mục, 0 lỗi | 16 mục, 0 lỗi |
| Bảng thiếu cột | 0 | 0 |
| Khởi động | không lỗi | không lỗi |
| Chỉ số trang chủ | lấy từ cơ sở dữ liệu | lấy từ cơ sở dữ liệu |

## Về việc "không còn lỗi"

Tôi không hứa điều đó, vì hứa thì cũng không giữ được.

Điều tôi bảo đảm là những gì đã kiểm chứng bằng công cụ và ghi lại ở trên: mọi
đường dẫn trả đúng, phân quyền ba mức đúng, bảy luồng dữ liệu đầu-cuối thông,
chạy được trên cả hai hệ quản trị cơ sở dữ liệu.

Điều tôi không bảo đảm: những tình huống chưa nghĩ tới, dữ liệu thật có hình dạng
khác dữ liệu thử, và cách người dùng thật thao tác. Đó là lý do cần một tuần dùng
thử với một phòng trước khi mở cho toàn đơn vị.

Bốn hạn chế đã biết vẫn còn nguyên, không phải lỗi mà là phần chưa làm: thời tiết
trang chủ dùng số cố định, bình chọn ảnh lưu ở máy người dùng, chưa có màn hình
quản lý tệp đã tải lên, bản tin chưa có trình soạn thảo định dạng.
