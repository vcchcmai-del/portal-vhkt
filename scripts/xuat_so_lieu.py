"""Kết xuất số liệu Dashboard ra data/dong-bo/*.csv để commit lên Git.

    python scripts/xuat_so_lieu.py

Chạy sau mỗi lần cập nhật số liệu, rồi commit thư mục data/dong-bo/ — như vậy
lịch sử Git ghi lại được từng thay đổi số liệu, không chỉ thay đổi mã nguồn.
"""
import io, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
GOC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(GOC, "backend"))
os.environ.setdefault("DATA_DIR", os.path.join(GOC, "data"))

from app.dongbo import THU_MUC, xuat  # noqa: E402

kq = xuat()
for tep, n in kq.items():
    print(f"{tep:<32}{n:>6} dòng")
print(f"\nĐã ghi vào {THU_MUC}")
