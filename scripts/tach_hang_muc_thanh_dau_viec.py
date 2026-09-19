# -*- coding: utf-8 -*-
"""Đưa hạng mục định lượng lên thành đầu việc cấp 2 của nhóm.

Trước đây một đầu việc ôm nhiều hạng mục con (vd "Sửa sợi 5G" ôm Sửa sợi, Lắp tủ
nguồn, Minishelter...), nhưng những hạng mục đó thực ra là các đầu việc ngang
hàng trong nhóm cấp 1 (Kế hoạch 5G). Script đưa mỗi hạng mục thành một đầu việc
của chính nhóm đó, mang theo toàn bộ số liệu cụm/FT và nhiệm vụ liên kết.

    set PORTAL_PASS=...
    python scripts/tach_hang_muc_thanh_dau_viec.py local          # chạy thử
    python scripts/tach_hang_muc_thanh_dau_viec.py local --that   # làm thật
    python scripts/tach_hang_muc_thanh_dau_viec.py live  --that --xoa-vo-rong

Quy tắc: hạng mục cùng tên với đầu việc đang chứa nó thì để yên (kể cả khi tên
chỉ thêm đuôi: "Kiểm soát WO theo FT" trong "Kiểm soát WO"); trùng tên một đầu
việc khác đã có thì nhập về đầu việc đó; còn lại tạo đầu việc mới cùng nhóm, kế
thừa nhân sự chủ trì. Đầu việc cũ hết hạng mục và không còn nhiệm vụ nào là tầng
trung gian thừa: mặc định chỉ liệt kê, thêm --xoa-vo-rong thì gỡ luôn.

Chạy lại nhiều lần được: phần nào đã đúng chỗ thì bỏ qua.
"""
import io
import os
import re
import sys
import unicodedata

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

DICH = {"local": "http://127.0.0.1:8000", "live": "https://portal-vhkt-backend.n1.tinhgon.xyz"}
B = DICH[sys.argv[1] if len(sys.argv) > 1 else "local"]
A = f"{B}/api/admin"
THAT = "--that" in sys.argv
XOA_VO = "--xoa-vo-rong" in sys.argv

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


def gon(t: str) -> str:
    """So tên bỏ dấu, bỏ khoảng trắng — để nhận ra "Sửa sợi" ~ "Sửa sợi 5G"."""
    t = unicodedata.normalize("NFD", (t or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", t)


def cung_mot_thu(a: str, b: str) -> bool:
    """Cùng một việc nếu tên trùng, hoặc tên này chỉ là tên kia thêm đuôi:
    "Kiểm soát WO theo FT" trong "Kiểm soát WO", "Sửa sợi" trong "Sửa sợi 5G"."""
    x, y = gon(a), gon(b)
    return bool(x) and bool(y) and (x.startswith(y) or y.startswith(x))


cau = ra(s.get(f"{A}/tech-tasks/structure"))
nhom_cua = {c["id"]: g["id"] for g in cau["nhom"] for c in g["categories"]}
ten_nhom = {g["id"]: g["label"] for g in cau["nhom"]}
cats = {c["id"]: c for c in ra(s.get(f"{A}/tech-tasks/categories"))}
theo_ten = {gon(c["label"]): c["id"] for c in cats.values()}
tasks = ra(s.get(f"{A}/tech-tasks"))

dem = {"de_yen": 0, "nhap_vao": 0, "tao_moi": 0}
rong = []

for khoi in ra(s.get(f"{A}/progress/items")):
    dv_cu = khoi["category"]
    hang_muc = khoi["items"]
    if not hang_muc:
        continue
    nhom = nhom_cua.get(dv_cu, "")
    chu_tri = cats.get(dv_cu, {}).get("owner", "")
    con_lai = 0
    for hm in hang_muc:
        if cung_mot_thu(hm["label"], cats[dv_cu]["label"]):
            dem["de_yen"] += 1
            con_lai += 1
            continue
        dich = theo_ten.get(gon(hm["label"]))
        if dich and dich != dv_cu:
            print(f"  → “{hm['label']}”: nhập về đầu việc đã có [{dich}]")
            dem["nhap_vao"] += 1
        else:
            print(f"  + “{hm['label']}”: đầu việc mới trong nhóm {ten_nhom.get(nhom, '—')}")
            dem["tao_moi"] += 1
            if not THAT:
                continue
            moi = ra(s.post(f"{A}/tech-tasks/categories",
                            json={"label": hm["label"], "group_code": nhom, "owner": chu_tri}))
            dich = moi["id"]
            cats[dich] = moi
            theo_ten[gon(hm["label"])] = dich
        if THAT:
            ra(s.put(f"{A}/progress/items/{hm['id']}", json={"category": dich}))
    if not con_lai:
        n_viec = sum(1 for t in tasks if t["category"] == dv_cu)
        rong.append((dv_cu, cats[dv_cu]["label"], n_viec))

print(f"\n{'ĐÃ LÀM' if THAT else 'CHẠY THỬ'} — để yên {dem['de_yen']}, "
      f"nhập vào đầu việc có sẵn {dem['nhap_vao']}, tạo mới {dem['tao_moi']}")
if rong:
    print("\nĐầu việc nay không còn hạng mục nào (tầng trung gian):")
    for ma, nhan, n in rong:
        if XOA_VO and not n:
            if THAT:
                ra(s.delete(f"{A}/tech-tasks/categories/{ma}"))
            print(f"  – [{ma}] {nhan} — gỡ (rỗng hoàn toàn)")
        else:
            print(f"  [{ma}] {nhan} — còn {n} nhiệm vụ"
                  + ("" if n else ", thêm --xoa-vo-rong để gỡ"))
