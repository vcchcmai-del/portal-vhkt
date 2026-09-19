# -*- coding: utf-8 -*-
"""Tạo hai đầu việc hoàn công và nạp bảng MCT tồn công nợ theo nhóm 1/2/3.

Nhóm Hoàn Công có hai mảng: Cơ điện và Truyền dẫn/IP. Mỗi mảng theo dõi số MCT
và công nợ theo trạng thái hồ sơ, chia làm ba nhóm MCT. Kế hoạch từng nhóm là
tổng các trạng thái nên script kiểm lại tổng trước khi ghi.

    set PORTAL_PASS=...
    python scripts/nap_hoan_cong.py local          # chạy thử
    python scripts/nap_hoan_cong.py local --that   # ghi thật
"""
import io
import os
import sys

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

KY = "2026-09"
NHOM_HOAN_CONG = "hoan_cong"

# (mã đầu việc mong muốn, tên) — số liệu hiện có mới của mảng Cơ điện.
MANG = [
    ("Hoàn công mảng Cơ điện", "co_dien"),
    ("Hoàn công mảng Truyền dẫn/IP", "truyen_dan"),
]

# nhóm -> trạng thái -> (số lượng MCT, công nợ tỷ đồng)
SO_LIEU_CO_DIEN = {
    1: {"trinh_ky": (86, 1.47), "nghiem_thu_sap": (3, 0.09), "da_nghiem_thu_sap": (0, 0.00),
        "ban_giao_ts": (11, 0.21), "doi_soat_4a": (0, 0.00), "huy_vuong": (4, 0.07), "chua_trinh": (5, 0.06)},
    2: {"trinh_ky": (109, 2.23), "nghiem_thu_sap": (6, 0.12), "da_nghiem_thu_sap": (0, 0.00),
        "ban_giao_ts": (3, 0.01), "doi_soat_4a": (0, 0.00), "huy_vuong": (14, 0.55), "chua_trinh": (17, 0.45)},
    3: {"trinh_ky": (15, 0.24), "nghiem_thu_sap": (3, 0.01), "da_nghiem_thu_sap": (0, 0.00),
        "ban_giao_ts": (1, 0.00), "doi_soat_4a": (0, 0.00), "huy_vuong": (2, 0.12), "chua_trinh": (159, 3.54)},
}
# Kế hoạch từng nhóm ghi trên bảng giấy, dùng để đối chiếu.
KE_HOACH_CO_DIEN = {1: (109, 1.90), 2: (149, 3.36), 3: (180, 3.91)}

DICH = {"local": "http://127.0.0.1:8000", "live": "https://portal-vhkt-backend.n1.tinhgon.xyz"}
B = DICH[sys.argv[1] if len(sys.argv) > 1 else "local"]
A = f"{B}/api/admin"
THAT = "--that" in sys.argv


def kiem_tra():
    """Cộng lại đúng như bảng giấy trước khi cho phép ghi."""
    loi = []
    for n, o in SO_LIEU_CO_DIEN.items():
        sl = sum(v[0] for v in o.values())
        cn = round(sum(v[1] for v in o.values()), 2)
        if (sl, cn) != KE_HOACH_CO_DIEN[n]:
            loi.append(f"Nhóm {n}: cộng {sl} MCT / {cn} ≠ kế hoạch {KE_HOACH_CO_DIEN[n]}")
    return loi


for x in kiem_tra():
    print("LỆCH:", x)
if kiem_tra():
    sys.exit("Dừng: số liệu chưa khớp bảng.")

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


cats = {c["label"]: c for c in ra(s.get(f"{A}/tech-tasks/categories"))}
dem = {"dau_viec": 0, "o": 0}

for ten, _mang in MANG:
    c = cats.get(ten)
    if c:
        ma = c["id"]
        print(f"  = đã có đầu việc “{ten}”")
        if THAT and c.get("kieu") != "hoan_cong":
            ra(s.put(f"{A}/tech-tasks/categories/{ma}", json={"kieu": "hoan_cong"}))
    else:
        dem["dau_viec"] += 1
        print(f"  + đầu việc “{ten}” trong nhóm Hoàn Công")
        ma = None
        if THAT:
            c = ra(s.post(f"{A}/tech-tasks/categories",
                          json={"label": ten, "group_code": NHOM_HOAN_CONG,
                                "hint": "MCT tồn công nợ theo nhóm 1/2/3 và trạng thái hồ sơ"}))
            ma = c["id"]
            ra(s.put(f"{A}/tech-tasks/categories/{ma}", json={"kieu": "hoan_cong"}))

    if ten != MANG[0][0]:
        continue                      # mới có số liệu của mảng Cơ điện
    for nhom, o in SO_LIEU_CO_DIEN.items():
        for trang_thai, (sl, cn) in o.items():
            dem["o"] += 1
            if THAT and ma:
                ra(s.put(f"{A}/hoan-cong/{ma}", json={"period": KY, "nhom": nhom,
                                                      "trang_thai": trang_thai,
                                                      "sl_mct": sl, "cong_no": cn}))

print(f"\n{'ĐÃ LÀM' if THAT else 'CHẠY THỬ'} — {dem['dau_viec']} đầu việc mới, {dem['o']} ô số liệu")
