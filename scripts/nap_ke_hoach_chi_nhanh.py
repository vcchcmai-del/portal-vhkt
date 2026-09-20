# -*- coding: utf-8 -*-
"""Nạp phần kế hoạch tháng chỉ có tổng toàn HCM, chưa chia được về cụm.

Bảng giấy tháng 09/2026 cho Cơ điện và một phần Kiểm soát VHKT chỉ ghi tổng
toàn chi nhánh. Trước đây số này được ghi thành nhiệm vụ con; từ khi bỏ lớp
nhiệm vụ, nó không còn chỗ đứng nên các ô nhóm báo 0. Script ghi số đó vào một
dòng số liệu mang mã trung tâm "CN" — dòng "chưa chia cụm" — nên khối lượng
đầu việc lại đủ, còn bảng 13 cụm vẫn trống để từng trung tâm điền dần (nhận
phần nào thì chuyển bớt số từ dòng CN sang cụm đó).

    set PORTAL_PASS=...
    python scripts/nap_ke_hoach_chi_nhanh.py local          # chạy thử, không ghi
    python scripts/nap_ke_hoach_chi_nhanh.py local --that   # ghi thật
    python scripts/nap_ke_hoach_chi_nhanh.py live  --that

Chạy lại nhiều lần được: dòng CN của cùng đầu việc/kỳ thì ghi đè, không đẻ dòng
mới. Script không đụng tới số thực hiện đã có và không đụng tới dòng cụm nào.
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
THAT = "--that" in sys.argv
CN = "CN"          # mã dòng "chưa chia cụm"

# Đầu việc nào lấy số từ bảng nào: (nhãn đầu việc, kế hoạch, ĐVT)
CAN_NAP = [(ten, kl, dvt) for ten, kl, dvt in D.CO_DIEN]
for _nhan, _tong, con in D.KIEM_SOAT:
    CAN_NAP += [(ten, kl, dvt) for ten, kl, dvt in con if kl]

TONG_PHAI_CO = sum(kl for _t, kl, _d in CAN_NAP)

dn = requests.post(f"{B}/api/auth/login", data={"username": "admin", "password": os.environ["PORTAL_PASS"]}).json()
s = requests.Session()
s.headers["Authorization"] = f"Bearer {dn['access_token']}"


def ra(r):
    if r.status_code >= 400:
        raise SystemExit(f"{r.status_code} {r.url} — {r.text[:300]}")
    return r.json()


def hang_muc(ma_dv):
    """Hạng mục mặc định của đầu việc — chưa có thì tạo một cái trùng tên."""
    ds = ra(s.get(f"{A}/progress/items", params={"category": ma_dv}))
    if ds:
        return ds[0]["id"]
    if not THAT:
        return "(moi)"
    return ra(s.post(f"{A}/progress/items", json={"category": ma_dv, "label": dau_viec_nhan[ma_dv]}))["id"]


def so_lieu(ma_dv, hm):
    if str(hm).startswith("(moi"):
        return []
    return ra(s.get(f"{A}/progress/centers", params={"category": ma_dv, "item": hm, "period": D.KY}))


dau_viec = {c["label"]: c for c in ra(s.get(f"{A}/tech-tasks/categories"))}
dau_viec_nhan = {c["id"]: c["label"] for c in dau_viec.values()}

print(f"== {B} — {'GHI THẬT' if THAT else 'CHẠY THỬ'} — kỳ {D.KY}")
print(f"   {len(CAN_NAP)} đầu việc, tổng kế hoạch phải có: {TONG_PHAI_CO:,}".replace(",", "."))

truoc, sau, bo_qua, khong_thay = {}, {}, [], []
for nhan, kl, dvt in CAN_NAP:
    c = dau_viec.get(nhan)
    if not c:
        khong_thay.append(nhan)
        continue
    hm = hang_muc(c["id"])
    ds = so_lieu(c["id"], hm)
    cum = [x for x in ds if x["center"] != CN and not x["ft_name"]]
    dong_cn = next((x for x in ds if x["center"] == CN and not x["ft_name"]), None)
    truoc[nhan] = {"cn": (dong_cn or {}).get("plan_qty", 0), "cum": sum(x["plan_qty"] or 0 for x in cum)}

    # Cụm đã có số rồi thì không đụng vào — người ta đã chia tay.
    if cum:
        bo_qua.append(f"{nhan}: đã có {len(cum)} cụm, tổng {truoc[nhan]['cum']:,.0f} — giữ nguyên")
        continue
    if truoc[nhan]["cn"] == kl:
        bo_qua.append(f"{nhan}: dòng chi nhánh đã đúng {kl:,.0f}")
        continue
    print(f"  {'+' if not dong_cn else '~'} {nhan}: {truoc[nhan]['cn']:,.0f} -> {kl:,.0f} {dvt}")
    if not THAT:
        continue
    than = {"category": c["id"], "item": hm, "period": D.KY, "center": CN,
            "plan_qty": kl, "note": f"Kế hoạch tháng 09/2026 — {dvt}, chưa chia cụm"}
    if dong_cn:
        than["done_qty"] = dong_cn.get("done_qty") or 0     # giữ nguyên thực hiện đã nhập
        than["bkk_qty"] = dong_cn.get("bkk_qty") or 0
        ra(s.put(f"{A}/progress/centers/{dong_cn['id']}", json=than))
    else:
        than["done_qty"] = 0
        ra(s.post(f"{A}/progress/centers", json=than))

for x in bo_qua:
    print("  ·", x)
for x in khong_thay:
    print("  ! không thấy đầu việc:", x)

# ---- đối chiếu lại từng giá trị sau khi ghi ----
print("\n-- đối chiếu từng đầu việc")
lech, dung = [], 0
for nhan, kl, _dvt in CAN_NAP:
    c = dau_viec.get(nhan)
    if not c:
        lech.append(f"{nhan}: không có đầu việc trong cổng")
        continue
    ds = so_lieu(c["id"], hang_muc(c["id"]))
    tong = sum(x["plan_qty"] or 0 for x in ds if not x["ft_name"])
    sau[nhan] = tong
    if abs(tong - kl) < 0.001:
        dung += 1
    else:
        lech.append(f"{nhan}: cổng {tong:,.0f} ≠ bảng {kl:,.0f}")

print(f"khớp {dung}/{len(CAN_NAP)} đầu việc; tổng trong cổng "
      f"{sum(sau.values()):,.0f} / bảng {TONG_PHAI_CO:,}".replace(",", "."))
for x in lech:
    print("  LỆCH:", x)
print("KẾT LUẬN:", "khớp hoàn toàn" if not lech else f"còn {len(lech)} chỗ lệch")
if not THAT:
    print("(mới chạy thử — thêm --that để ghi thật)")
