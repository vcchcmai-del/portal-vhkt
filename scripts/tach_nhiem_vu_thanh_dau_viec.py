# -*- coding: utf-8 -*-
"""Đưa nhiệm vụ lên thành đầu việc theo dõi tới mức trung tâm.

Trước đây một đầu việc gom nhiều nhiệm vụ chỉ có tổng chỉ tiêu toàn chi nhánh
("Chỉ tiêu bảo dưỡng" ôm Thực hiện bảo dưỡng nhà trạm / Bảo dưỡng tuyến cáp
truyền dẫn / Bảo dưỡng THC). Mỗi việc như vậy thực ra là một đầu việc của nhóm
và phải chia được về từng trung tâm. Script:

  - mỗi nhiệm vụ thành một đầu việc của chính nhóm đó (giữ nhân sự chủ trì),
  - tạo hạng mục định lượng để bảng 13 trung tâm hiện ra chờ nhập,
  - ghi tổng chỉ tiêu cũ vào phần gợi ý của đầu việc để không mất số,
  - nhiệm vụ cũ đưa vào Thùng rác (khôi phục được),
  - đầu việc cha rỗng hẳn thì gỡ khi có cờ --xoa-vo-rong.

Đầu việc đang có đúng một nhiệm vụ trùng tên mình (kế hoạch tháng của mảng Cơ
điện) thì giữ nguyên đầu việc, chỉ chuyển chỉ tiêu và thêm hạng mục.

    set PORTAL_PASS=...
    python scripts/tach_nhiem_vu_thanh_dau_viec.py local            # chạy thử
    python scripts/tach_nhiem_vu_thanh_dau_viec.py local --that --xoa-vo-rong
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
DON_RAC = "--don-thung-rac" in sys.argv   # xoá hẳn nhiệm vụ cũ đang nằm trong Thùng rác

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
    t = unicodedata.normalize("NFD", (t or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", t)


def bo_tien_to(ten: str) -> str:
    """"Kế hoạch tháng 09/2026 — Lắp đặt ATS" -> "Lắp đặt ATS"."""
    return ten.split("—", 1)[1].strip() if "—" in ten else ten.strip()


def so_vn(x) -> str:
    return f"{x:,.0f}".replace(",", ".")


cau = ra(s.get(f"{A}/tech-tasks/structure"))
nhom_cua = {c["id"]: g["id"] for g in cau["nhom"] for c in g["categories"]}
ten_nhom = {g["id"]: g["label"] for g in cau["nhom"]}
cats = {c["id"]: c for c in ra(s.get(f"{A}/tech-tasks/categories"))}
theo_ten = {gon(c["label"]): c["id"] for c in cats.values()}
hang_muc = {x["category"]: x["items"] for x in ra(s.get(f"{A}/progress/items"))}

viec = {}
for t in ra(s.get(f"{A}/tech-tasks")):
    viec.setdefault(t["category"], []).append(t)

dem = {"giu": 0, "tao": 0, "hang_muc": 0, "bo_viec": 0}
rong = []
rac_cua = {}          # đầu việc cha -> id nhiệm vụ vừa cho vào Thùng rác


def them_hang_muc(ma_dv, nhan):
    """Có hạng mục rồi thì thôi — chạy lại script không đẻ thêm."""
    if ma_dv is None:            # chạy thử: đầu việc chưa thật sự tạo
        dem["hang_muc"] += 1
        return
    co = hang_muc.get(ma_dv) or []
    if any(gon(i["label"]) == gon(nhan) for i in co):
        return
    dem["hang_muc"] += 1
    if THAT:
        ra(s.post(f"{A}/progress/items", json={"category": ma_dv, "label": nhan}))


def goi_y(cha: str, kl, dvt: str) -> str:
    phan = []
    if cha:
        phan.append(cha)
    phan.append(f"chỉ tiêu tháng 09/2026: {so_vn(kl)} {dvt}".strip() if kl
                else "chưa giao chỉ tiêu tháng 09/2026")
    return " · ".join(phan)


for ma_dv, ds in sorted(viec.items()):
    cha = cats.get(ma_dv)
    if not cha:
        continue
    nhom = nhom_cua.get(ma_dv, "")
    mot_minh = len(ds) == 1 and gon(bo_tien_to(ds[0]["title"])) == gon(cha["label"])

    for t in ds:
        ten = bo_tien_to(t["title"])
        kl, dvt = t.get("volume_plan") or 0, t.get("volume_unit") or ""
        if mot_minh:
            dich = ma_dv
            dem["giu"] += 1
            print(f"  = giữ đầu việc “{cha['label']}” ({so_vn(kl)} {dvt})")
            if THAT:
                ra(s.put(f"{A}/tech-tasks/categories/{dich}",
                         json={"hint": goi_y("", kl, dvt)}))
        else:
            dich = theo_ten.get(gon(ten))
            if dich and dich != ma_dv:
                print(f"  → “{ten}”: nhập về đầu việc đã có")
            else:
                dem["tao"] += 1
                print(f"  + “{ten}”: đầu việc mới trong nhóm {ten_nhom.get(nhom, '—')} ({so_vn(kl)} {dvt})")
                if not THAT:
                    dich = None
                else:
                    moi = ra(s.post(f"{A}/tech-tasks/categories",
                                    json={"label": ten, "group_code": nhom,
                                          "owner": cha.get("owner", ""),
                                          "hint": goi_y(cha["label"], kl, dvt)}))
                    dich = moi["id"]
                    cats[dich] = moi
                    theo_ten[gon(ten)] = dich

        them_hang_muc(dich, ten if not mot_minh else cha["label"])
        dem["bo_viec"] += 1
        if THAT:
            ra(s.delete(f"{A}/tech-tasks/{t['id']}"))      # vào Thùng rác, khôi phục được
            rac_cua.setdefault(ma_dv, []).append(t["id"])

    if not mot_minh:
        rong.append((ma_dv, cha["label"]))

print(f"\n{'ĐÃ LÀM' if THAT else 'CHẠY THỬ'} — giữ {dem['giu']}, tạo mới {dem['tao']}, "
      f"thêm {dem['hang_muc']} hạng mục, đưa {dem['bo_viec']} nhiệm vụ vào Thùng rác")

if rong:
    print("\nĐầu việc cha nay chỉ còn là tầng trung gian:")
    for ma, nhan in rong:
        # Hạng mục của cha mà chưa có dòng số liệu nào thì cũng chỉ là vỏ.
        con_hm = []
        for i in (hang_muc.get(ma) or []):
            n = len(ra(s.get(f"{A}/progress/centers",
                             params={"category": ma, "item": i["id"], "period": "2026-09"})))
            if n:
                con_hm.append(i)
            elif XOA_VO and THAT:
                s.delete(f"{A}/progress/items/{i['id']}")
        if XOA_VO and not con_hm:
            if THAT:
                r = s.delete(f"{A}/tech-tasks/categories/{ma}")
                if r.status_code == 409 and DON_RAC:
                    # Nhiệm vụ cũ nằm trong Thùng rác chặn việc gỡ; nội dung của
                    # chúng đã thành đầu việc riêng nên xoá hẳn là được.
                    for i in rac_cua.get(ma, []):
                        s.delete(f"{A}/trash/tech_tasks/{i}")
                    r = s.delete(f"{A}/tech-tasks/categories/{ma}")
                if r.status_code >= 400:
                    print(f"  ! [{ma}] {nhan} — chưa gỡ được: {r.json().get('detail', '')[:90]}")
                    continue
            print(f"  – [{ma}] {nhan} — gỡ")
        else:
            print(f"  [{ma}] {nhan} — còn {len(con_hm)} hạng mục"
                  + ("" if con_hm else ", thêm --xoa-vo-rong để gỡ"))
