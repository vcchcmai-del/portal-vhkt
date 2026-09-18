# -*- coding: utf-8 -*-
"""Nạp kế hoạch tháng vào cổng: đầu việc -> hạng mục -> số liệu từng cụm.

Số liệu để trong ke_hoach_thang_<tháng>_<năm>.py; tháng sau chỉ cần chép tệp đó,
sửa số rồi đổi dòng import bên dưới.

    set PORTAL_PASS=...
    python scripts/nap_ke_hoach_thang.py local            # chạy thử, không ghi
    python scripts/nap_ke_hoach_thang.py local --that     # ghi thật
    python scripts/nap_ke_hoach_thang.py live  --that

Chạy lại được nhiều lần: đầu việc/hạng mục trùng tên thì dùng lại, dòng cụm và
nhiệm vụ được ghi đè — nên sau khi máy chủ live lên bản mới, chạy lại một lần
nữa là điền nốt nhóm và khối lượng mà bản cũ bỏ qua.
"""
import io
import os
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
import ke_hoach_thang_09_2026 as D

DICH = {"local": "http://127.0.0.1:8000", "live": "https://portal-vhkt-backend.n1.tinhgon.xyz"}
B = DICH[sys.argv[1] if len(sys.argv) > 1 else "local"]
A = f"{B}/api/admin"
THAT = "--that" in sys.argv          # không có cờ này thì chỉ chạy thử, không ghi

loi = D.kiem_tra()
for x in loi:
    print("LỆCH:", x)
if [x for x in loi if "Khắc phục lỗi báo hỏng" not in x]:
    sys.exit("Dừng: số liệu chưa khớp bảng.")

dn = requests.post(f"{B}/api/auth/login", data={"username": "admin", "password": os.environ["PORTAL_PASS"]}).json()
s = requests.Session()
s.headers["Authorization"] = f"Bearer {dn['access_token']}"


def ra(r):
    if r.status_code >= 400:
        raise SystemExit(f"{r.status_code} {r.url} — {r.text[:300]}")
    return r.json()


dau_viec = {c["label"]: c for c in ra(s.get(f"{A}/tech-tasks/categories"))}
viec_da_co = {(t["category"], t["title"]): t["id"] for t in ra(s.get(f"{A}/tech-tasks"))}
dem = {"dau_viec": 0, "hang_muc": 0, "cum": 0, "nhiem_vu": 0}
NGAY = ("2026-09-01", "2026-09-30")


def them_dau_viec(nhan, nhom, hint=""):
    c = dau_viec.get(nhan)
    if c:
        if c["group"] != nhom or (hint and c["hint"] != hint):
            if THAT:
                ra(s.put(f"{A}/tech-tasks/categories/{c['id']}", json={"group_code": nhom, "hint": hint or c["hint"]}))
            print(f"  ~ đầu việc “{nhan}” -> nhóm {nhom}")
        return c["id"]
    if not THAT:
        print(f"  + đầu việc “{nhan}”")
        dem["dau_viec"] += 1
        return f"(moi:{nhan})"
    c = ra(s.post(f"{A}/tech-tasks/categories", json={"label": nhan, "group_code": nhom, "hint": hint}))
    dau_viec[nhan] = c
    dem["dau_viec"] += 1
    print(f"  + đầu việc “{nhan}” ({c['id']})")
    return c["id"]


def them_hang_muc(ma_dv, nhan):
    if not THAT or ma_dv.startswith("(moi"):
        dem["hang_muc"] += 1
        return f"(moi:{nhan})"
    ds = ra(s.get(f"{A}/progress/items", params={"category": ma_dv}))
    cu = next((i for i in ds if i["label"] == nhan), None)
    if cu:
        return cu["id"]
    hm = ra(s.post(f"{A}/progress/items", json={"category": ma_dv, "label": nhan}))
    dem["hang_muc"] += 1
    return hm["id"]


def them_nhiem_vu(ma_dv, tieu_de, khoi_luong, dvt, hang_muc=None):
    """Có rồi thì cập nhật lại khối lượng/hạng mục — để chạy lại được sau khi
    máy chủ live lên bản mới (bản cũ bỏ qua các trường này)."""
    body = {"category": ma_dv, "title": tieu_de, "status": "todo", "priority": "trung_binh",
            "start_at": NGAY[0], "due_at": NGAY[1], "volume_unit": dvt,
            "volume_plan": khoi_luong, "volume_done": 0,
            "note": "Kế hoạch tháng 09/2026"}
    if hang_muc:
        body["progress_item"] = hang_muc
    cu = viec_da_co.get((ma_dv, tieu_de))
    dem["nhiem_vu"] += 1
    if not THAT or ma_dv.startswith("(moi"):
        return
    if cu:
        ra(s.put(f"{A}/tech-tasks/{cu}", json=body))
    else:
        ra(s.post(f"{A}/tech-tasks", json=body))


def them_cum(ma_dv, hang_muc, ds_so):
    for ma, so in zip(D.CUM, ds_so):
        if not so:
            continue
        dem["cum"] += 1
        if not THAT or str(hang_muc).startswith("(moi"):
            continue
        ra(s.post(f"{A}/progress/centers", json={"category": ma_dv, "item": hang_muc, "period": D.KY,
                                                 "center": ma, "plan_qty": so, "done_qty": 0,
                                                 "note": "Kế hoạch tháng 09/2026"}))


print(f"== {B} — {'GHI THẬT' if THAT else 'CHẠY THỬ'}")
for nhom, bang in (("truyen_dan", D.TRUYEN_DAN), ("cdbr", D.CDBR)):
    print(f"\n-- nhóm {nhom}")
    for nhan, dvt, hcm, ds in bang:
        ma = them_dau_viec(nhan, nhom)
        hm = them_hang_muc(ma, nhan)
        them_cum(ma, hm, ds)
        them_nhiem_vu(ma, f"Kế hoạch tháng 09/2026 — {nhan}", hcm, dvt, hm)

print("\n-- nhóm kiem_soat_vhkt")
for nhan, tong, con in D.KIEM_SOAT:
    ma = them_dau_viec(nhan, "kiem_soat_vhkt", hint=f"Chỉ tiêu tháng 09/2026: {tong:,}".replace(",", "."))
    for ten_con, kl, dvt in con:
        them_nhiem_vu(ma, ten_con, kl, dvt)

print("\n-- nhóm co_dien")
for nhan, kl, dvt in D.CO_DIEN:
    ma = them_dau_viec(nhan, "co_dien")
    them_nhiem_vu(ma, f"Kế hoạch tháng 09/2026 — {nhan}", kl, dvt)

print("\nTổng cộng:", dem)
