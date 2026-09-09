"""Nạp số liệu từ data/dong-bo/*.csv vào cơ sở dữ liệu.

    python scripts/nap_so_lieu.py

Ghi đè theo khoá nhận diện của từng bảng, chạy lại nhiều lần vẫn ra một kết quả.
Dữ liệu không có trong tệp thì giữ nguyên, không bị xoá.
"""
import io, os, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
GOC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(GOC, "backend"))
os.environ.setdefault("DATA_DIR", os.path.join(GOC, "data"))

from app.dongbo import nap  # noqa: E402

for tep, (them, sua) in nap().items():
    print(f"{tep:<32} thêm {them:>5}, cập nhật {sua:>5}")
