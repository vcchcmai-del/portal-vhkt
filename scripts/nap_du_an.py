# -*- coding: utf-8 -*-
"""Tạo nhóm Dự án và nạp bảng theo dõi điểm triển khai theo đơn vị.

Mỗi đơn vị có tổng số điểm triển khai và số điểm đã qua từng bước; tỉ lệ hoàn
thành do cổng tự chia nên script chỉ nạp khối lượng và đối chiếu lại tỉ lệ ghi
trên bảng giấy.

    set PORTAL_PASS=...
    python scripts/nap_du_an.py local          # chạy thử
    python scripts/nap_du_an.py local --that   # ghi thật
"""
import io
import os
import sys

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

KY = "2026-09"
NHOM = ("du_an", "Dự án")
DAU_VIEC = "Triển khai điểm phát sóng"

# (khối, đơn vị, tổng triển khai, khảo sát, phân bổ, lắp đặt, nghiệm thu, bản vẽ, ký BBBG, ký BB XN)
BANG = [
    ("ACT", "PTO", 4, 4, 4, 4, 4, 4, 4, 4),
    ("ACT", "SGN", 7, 7, 7, 7, 6, 6, 6, 6),
    ("ACT", "GĐH", 8, 8, 8, 8, 5, 5, 5, 5),
    ("ACT", "BSG", 2, 2, 2, 2, 2, 2, 2, 2),
    ("ACT", "TĐC", 3, 3, 3, 3, 3, 3, 3, 3),
    ("ACT", "TSG", 1, 1, 1, 1, 1, 1, 1, 1),
    ("ACT", "NSG", 1, 1, 1, 1, 1, 1, 1, 1),
    ("BDG", "Thủ Dầu Một", 2, 2, 2, 2, 2, 2, 2, 2),
    ("BDG", "Phú Giáo", 2, 2, 2, 2, 2, 2, 2, 2),
    ("BDG", "Thuận An", 4, 4, 4, 4, 4, 4, 4, 4),
    ("BDG", "Dĩ An", 1, 1, 1, 1, 1, 1, 1, 1),
    ("VTU", "Bà Rịa", 4, 4, 4, 4, 4, 4, 4, 4),
    ("VTU", "Vũng Tàu", 5, 5, 5, 5, 5, 5, 5, 5),
]
BUOC = ["khao_sat", "phan_bo", "lap_dat", "nghiem_thu", "ban_ve", "ky_bbbg", "ky_bb_xn"]

# Tỉ lệ ký BBBG ghi trên bảng giấy, dùng để đối chiếu phép chia của cổng.
TY_LE_BBBG = {"PTO": 100.0, "SGN": 85.7, "GĐH": 62.5, "BSG": 100.0, "TĐC": 100.0, "TSG": 100.0,
              "NSG": 100.0, "Thủ Dầu Một": 100.0, "Phú Giáo": 100.0, "Thuận An": 100.0,
              "Dĩ An": 100.0, "Bà Rịa": 100.0, "Vũng Tàu": 100.0}


def kiem_tra():
    """Không bước nào được vượt tổng triển khai; tỉ lệ ký BBBG phải khớp bảng."""
    loi = []
    for khoi, dv, tong, *b in BANG:
        for ma, v in zip(BUOC, b):
            if v > tong:
                loi.append(f"{dv}: {ma} = {v} vượt tổng triển khai {tong}")
        ty = round(b[BUOC.index("ky_bbbg")] / tong * 100, 1) if tong else 0
        if abs(ty - TY_LE_BBBG[dv]) > 0.1:
            loi.append(f"{dv}: tỉ lệ ký BBBG tính ra {ty}% ≠ bảng {TY_LE_BBBG[dv]}%")
    return loi


for x in kiem_tra():
    print("LỆCH:", x)
if kiem_tra():
    sys.exit("Dừng: số liệu chưa khớp bảng.")

DICH = {"local": "http://127.0.0.1:8000", "live": "https://portal-vhkt-backend.n1.tinhgon.xyz"}
B = DICH[sys.argv[1] if len(sys.argv) > 1 else "local"]
A = f"{B}/api/admin"
THAT = "--that" in sys.argv

mat_khau = os.environ.get("PORTAL_PASS")
if not mat_khau:
    sys.exit("Đặt mật khẩu admin vào biến môi trường PORTAL_PASS trước khi chạy.")
dn = requests.post(f"{B}/api/auth/login", data={"username": "admin", "password": mat_khau}).json()
s = requests.Session()
s.headers["Authorization"] = f"Bearer {dn['access_token']}"


def ra(r):
    if r.status_code >= 400:
        raise SystemExit(f"{r.status_code} {r.url} — {r.text[:300]}")
    return r.json()


cau = ra(s.get(f"{A}/tech-tasks/structure"))
ma_nhom = next((g["id"] for g in cau["nhom"] if g["label"] == NHOM[1]), None)
if not ma_nhom:
    print(f"  + nhóm “{NHOM[1]}”")
    if THAT:
        ma_nhom = ra(s.post(f"{A}/tech-tasks/groups", json={"label": NHOM[1]}))["id"]

cats = {c["label"]: c for c in ra(s.get(f"{A}/tech-tasks/categories"))}
c = cats.get(DAU_VIEC)
ma = c["id"] if c else None
if c:
    print(f"  = đã có đầu việc “{DAU_VIEC}”")
    if THAT and c.get("kieu") != "du_an":
        ra(s.put(f"{A}/tech-tasks/categories/{ma}", json={"kieu": "du_an"}))
else:
    print(f"  + đầu việc “{DAU_VIEC}” trong nhóm {NHOM[1]}")
    if THAT:
        ma = ra(s.post(f"{A}/tech-tasks/categories",
                       json={"label": DAU_VIEC, "group_code": ma_nhom,
                             "hint": "Theo dõi từng điểm triển khai qua các bước, tỉ lệ hoàn thành tự tính"}))["id"]
        ra(s.put(f"{A}/tech-tasks/categories/{ma}", json={"kieu": "du_an"}))

for i, (khoi, dv, tong, *b) in enumerate(BANG):
    if THAT and ma:
        ra(s.put(f"{A}/du-an/{ma}", json={"period": KY, "don_vi": dv, "khoi": khoi, "order_no": i,
                                          "tong_trien_khai": tong, **dict(zip(BUOC, b))}))

print(f"\n{'ĐÃ LÀM' if THAT else 'CHẠY THỬ'} — {len(BANG)} đơn vị, "
      f"tổng {sum(r[2] for r in BANG)} điểm triển khai")
