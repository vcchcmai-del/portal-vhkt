"""Đối chiếu bảng số liệu giữa máy đang làm và bản chạy thật, và đồng bộ nếu cần.

    python scripts/doi_chieu_so_lieu.py            # chỉ xem chênh lệch
    python scripts/doi_chieu_so_lieu.py commit     # đưa bản chạy thật khớp local

So theo khoá (bảng, kỳ, chỉ tiêu, đơn vị): thiếu thì thêm, lệch giá trị thì sửa,
thừa thì xoá. Luôn in ra từng nhóm trước khi ghi.

Vì sao cần: hai bên được sửa bằng những lần nhập khác nhau, lại chạy hai phiên
bản mã nguồn khác nhau, nên dễ trôi ra xa nhau mà không ai để ý — có lần bản
chạy thật giữ song song hai dãy KPI TKM (một dãy có đơn vị, một dãy bỏ trống,
giá trị khác nhau) và hiện trùng nhau trên bảng đối chiếu. Chạy lệnh này sau mỗi
đợt cập nhật số liệu thì thấy ngay.

Địa chỉ hai bên đặt trong hai biến L và W bên dưới.
"""
import io
import sys

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
THAT = len(sys.argv) > 1 and sys.argv[1] == "commit"

L = "http://127.0.0.1:8000"
W = "https://portal-vhkt-backend.n1.tinhgon.xyz"
BANG = ["KPI", "KPI_TARGET", "KPI_VTT", "KPI_VTNET", "WO", "WO_TARGET", "WO_TINH",
        "WO_HUYEN_BD", "WO_HUYEN_BRVT", "PAKH", "PAKH_TARGET", "FUEL", "FUEL_TARGET",
        "OUTPUT", "OUTPUT_TARGET", "NETWORK", "NETWORK_TARGET", "VHKT", "VHKT_TARGET",
        "HIRE"]


def phien(base):
    s = requests.Session()
    r = s.post(f"{base}/api/auth/login",
               data={"username": "admin", "password": "viettel@2026"}, timeout=30)
    r.raise_for_status()
    return s, {"Authorization": f"Bearer {r.json()['access_token']}"}


def lay(base):
    s, h = phien(base)
    ra = {}
    for b in BANG:
        for x in s.get(f"{base}/api/admin/metrics", headers=h, params={"board": b}, timeout=60).json():
            ra[(x["board"], x["period"], x["label"], x["unit_name"] or "")] = x
    return s, h, ra


_, _, cua_local = lay(L)
sw, hw, cua_web = lay(W)
print(f"local {len(cua_local)} khoá | web {len(cua_web)} khoá\n")

thieu = [k for k in cua_local if k not in cua_web]
thua = [k for k in cua_web if k not in cua_local]
lech = [k for k in cua_local
        if k in cua_web and abs((cua_local[k]["value"] or 0) - (cua_web[k]["value"] or 0)) > 0.001]


def gom(ds):
    d = {}
    for k in ds:
        d[(k[0], k[2], k[3])] = d.get((k[0], k[2], k[3]), 0) + 1
    return d


print(f"1) Web THIẾU {len(thieu)} dòng:")
for (b, ct, dv), n in sorted(gom(thieu).items()):
    print(f"   {b:<16}{ct:<28}{dv or '(trống)':<12}{n}")
print(f"\n2) Web THỪA {len(thua)} dòng:")
for (b, ct, dv), n in sorted(gom(thua).items()):
    print(f"   {b:<16}{ct:<28}{dv or '(trống)':<12}{n}")
print(f"\n3) LỆCH giá trị {len(lech)} dòng:")
for k in sorted(lech):
    print(f"   {k[0]} {k[1]} {k[2]} / {k[3] or '(trống)'}: web {cua_web[k]['value']} -> local {cua_local[k]['value']}")


if not THAT:
    print("\n(xem thử — thêm 'commit' để ghi thật)")
    sys.exit()

loi = 0
for k in thua:
    r = sw.delete(f"{W}/api/admin/metrics/{cua_web[k]['id']}", headers=hw, timeout=30)
    if r.status_code != 200:
        loi += 1; print("   LỖI xoá", k, r.status_code, r.text[:120])
for k in lech:
    r = sw.put(f"{W}/api/admin/metrics/{cua_web[k]['id']}", headers=hw,
               json={"value": cua_local[k]["value"]}, timeout=30)
    if r.status_code != 200:
        loi += 1; print("   LỖI sửa", k, r.status_code, r.text[:120])
for k in thieu:
    x = cua_local[k]
    r = sw.post(f"{W}/api/admin/metrics", headers=hw, json={
        "board": x["board"], "period": x["period"], "label": x["label"],
        "unit_name": x["unit_name"], "value": x["value"]}, timeout=30)
    if r.status_code != 200:
        loi += 1; print("   LỖI thêm", k, r.status_code, r.text[:120])
print(f"\nXong. {loi} lỗi.")
