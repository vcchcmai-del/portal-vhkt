# -*- coding: utf-8 -*-
"""Đẩy toàn bộ cơ cấu và số liệu mảng kỹ thuật từ máy cục bộ lên bản live.

Máy cục bộ là nơi dựng lại cơ cấu (nhóm đầu việc, đầu việc, hạng mục, số liệu
cụm/FT, hoàn công, dự án); bản live thì còn nằm ở cơ cấu cũ. Script chép sang
sao cho live trông đúng như local: cùng nhóm, cùng đầu việc, cùng từng con số.

    set PORTAL_PASS=...
    python scripts/dong_bo_len_live.py                 # chạy thử, không ghi gì
    python scripts/dong_bo_len_live.py --that          # ghi thật
    python scripts/dong_bo_len_live.py --that --xoa-thua   # ghi và dọn phần live thừa

Trước khi ghi, toàn bộ dữ liệu live được tải về một tệp JSON để còn đường lùi
(mặc định đặt trong thư mục tạm, KHÔNG nằm trong kho mã vì có tên người).
Ghi xong, script đọc lại live và so từng giá trị với local rồi mới kết luận.
"""
import io
import json
import os
import sys
import tempfile
import time
from datetime import datetime

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

LOCAL = "http://127.0.0.1:8000"
LIVE = "https://portal-vhkt-backend.n1.tinhgon.xyz"
THAT = "--that" in sys.argv
XOA_THUA = "--xoa-thua" in sys.argv
SAO_LUU = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--sao-luu=")),
               os.path.join(tempfile.gettempdir(),
                            f"live-truoc-dong-bo-{datetime.now():%Y%m%d-%H%M%S}.json"))


def phien(goc):
    dn = requests.post(f"{goc}/api/auth/login",
                       data={"username": "admin", "password": os.environ["PORTAL_PASS"]},
                       timeout=60).json()
    if "access_token" not in dn:
        raise SystemExit(f"Không đăng nhập được {goc}: {dn}")
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {dn['access_token']}"
    s.goc = goc
    return s


def lay(s, duong, **tham_so):
    r = s.get(f"{s.goc}/api/admin{duong}", params=tham_so or None, timeout=120)
    if r.status_code >= 400:
        raise SystemExit(f"GET {duong} -> {r.status_code} {r.text[:200]}")
    return r.json()


def ghi(s, cach, duong, than=None):
    if not THAT:
        return {}
    for lan in range(3):
        try:
            r = getattr(s, cach)(f"{s.goc}/api/admin{duong}", json=than, timeout=120)
        except requests.RequestException as e:
            if lan == 2:
                raise SystemExit(f"{cach.upper()} {duong} -> {e}")
            time.sleep(2)
            continue
        if r.status_code < 400:
            return r.json() if r.text else {}
        if r.status_code >= 500 and lan < 2:
            time.sleep(2)
            continue
        raise SystemExit(f"{cach.upper()} {duong} -> {r.status_code} {r.text[:300]}")
    return {}


# --------------------------------------------------------------- đọc hai bên
B = phien(LOCAL)
L = phien(LIVE)
print(f"== {'GHI THẬT' if THAT else 'CHẠY THỬ'} — {LOCAL} -> {LIVE}")


def doc_het(s):
    """Toàn bộ mảng kỹ thuật của một bên, gom theo khóa để đối chiếu."""
    d = {"nhom": lay(s, "/tech-tasks/groups"),
         "dau_viec": lay(s, "/tech-tasks/categories"),
         "nhiem_vu": lay(s, "/tech-tasks"),
         "ky": lay(s, "/progress/periods"),
         "hang_muc": {}, "so_lieu": {}, "hoan_cong": {}, "du_an": {}}
    for c in d["dau_viec"]:
        ma = c["id"]
        d["hang_muc"][ma] = lay(s, "/progress/items", category=ma)
        kieu = c.get("kieu") or "cum"
        for ky in d["ky"] or []:
            if kieu == "hoan_cong":
                d["hoan_cong"][(ma, ky)] = lay(s, f"/hoan-cong/{ma}", period=ky)
            elif kieu == "du_an":
                d["du_an"][(ma, ky)] = lay(s, f"/du-an/{ma}", period=ky)
            for hm in d["hang_muc"][ma]:
                dong = lay(s, "/progress/centers", category=ma, item=hm["id"], period=ky)
                for x in dong:
                    d["so_lieu"][(ma, hm["id"], ky, x["center"], "")] = x
                for x in dong:
                    for f in lay(s, "/progress/ft", category=ma, item=hm["id"],
                                 period=ky, center=x["center"]):
                        d["so_lieu"][(ma, hm["id"], ky, f["center"], f["ft_name"])] = f
    return d


print("đang đọc local…")
loc = doc_het(B)
print("đang đọc live…")
live = doc_het(L)
print(f"   local: {len(loc['dau_viec'])} đầu việc, {len(loc['so_lieu'])} dòng số liệu, "
      f"{len(loc['nhiem_vu'])} nhiệm vụ")
print(f"   live : {len(live['dau_viec'])} đầu việc, {len(live['so_lieu'])} dòng số liệu, "
      f"{len(live['nhiem_vu'])} nhiệm vụ")

with io.open(SAO_LUU, "w", encoding="utf-8") as f:
    json.dump({k: (v if not isinstance(v, dict) else {str(a): b for a, b in v.items()})
               for k, v in live.items()}, f, ensure_ascii=False, indent=1)
print(f"   đã lưu bản live hiện tại: {SAO_LUU}")

# ------------------------------------------------------------------ nhóm
print("\n-- nhóm đầu việc")
nhom_live = {g["id"]: g for g in live["nhom"] if g["id"]}
nhan_live = {g["label"]: g["id"] for g in live["nhom"] if g["id"]}
anh_xa_nhom = {}
for i, g in enumerate(loc["nhom"]):
    if not g["id"]:
        continue
    cu = nhom_live.get(g["id"]) or nhom_live.get(nhan_live.get(g["label"], ""))
    if cu:
        anh_xa_nhom[g["id"]] = cu["id"]
        if cu["label"] != g["label"]:
            print(f"  ~ {cu['label']} -> {g['label']}")
            ghi(L, "put", f"/tech-tasks/groups/{cu['id']}", {"label": g["label"], "order_no": i})
        continue
    print(f"  + nhóm “{g['label']}”")
    moi = ghi(L, "post", "/tech-tasks/groups", {"label": g["label"], "note": g.get("note") or "",
                                                "order_no": i})
    anh_xa_nhom[g["id"]] = moi.get("id", g["id"])
    if THAT:
        ghi(L, "put", f"/tech-tasks/groups/{anh_xa_nhom[g['id']]}", {"order_no": i})

# --------------------------------------------------------------- đầu việc
print("\n-- đầu việc")
dv_live = {c["id"]: c for c in live["dau_viec"]}
dv_theo_nhan = {c["label"]: c for c in live["dau_viec"]}
anh_xa_dv, them, sua = {}, 0, 0
for i, c in enumerate(loc["dau_viec"]):
    cu = dv_live.get(c["id"]) or dv_theo_nhan.get(c["label"])
    if not cu:
        print(f"  + {c['label']}")
        moi = ghi(L, "post", "/tech-tasks/categories",
                  {"label": c["label"], "hint": c.get("hint") or "", "owner": c.get("owner") or "",
                   "group_code": anh_xa_nhom.get(c.get("group") or "", "")})
        ma = moi.get("id", c["id"])
        them += 1
    else:
        ma = cu["id"]
    anh_xa_dv[c["id"]] = ma
    than = {"label": c["label"], "hint": c.get("hint") or "", "owner": c.get("owner") or "",
            "group_code": anh_xa_nhom.get(c.get("group") or "", ""),
            "kieu": c.get("kieu") or "cum", "hc_don_vi": c.get("hc_don_vi") or "ty",
            "order_no": i, "active": True}
    khac = cu and any((cu.get(k) or "") != (v or "") for k, v in
                      (("label", c["label"]), ("hint", c.get("hint")), ("owner", c.get("owner")),
                       ("group", anh_xa_nhom.get(c.get("group") or "", "")),
                       ("kieu", c.get("kieu") or "cum")))
    if khac:
        sua += 1
        print(f"  ~ {cu['label']}"
              + (f" -> {c['label']}" if cu["label"] != c["label"] else "")
              + f"  [nhóm {cu.get('group') or '—'} -> {than['group_code'] or '—'}]")
    ghi(L, "put", f"/tech-tasks/categories/{ma}", than)
print(f"  thêm {them}, sửa {sua}, giữ nguyên {len(loc['dau_viec']) - them - sua}")

# --------------------------------------------------------------- hạng mục
print("\n-- hạng mục")
anh_xa_hm, them_hm = {}, 0
for ma_loc, ds in loc["hang_muc"].items():
    ma_live = anh_xa_dv.get(ma_loc)
    if not ma_live:
        continue
    co = {h["label"]: h["id"] for h in (live["hang_muc"].get(ma_live) or [])}
    for hm in ds:
        if hm["label"] in co:
            anh_xa_hm[hm["id"]] = co[hm["label"]]
            continue
        them_hm += 1
        moi = ghi(L, "post", "/progress/items", {"category": ma_live, "label": hm["label"]})
        anh_xa_hm[hm["id"]] = moi.get("id", hm["id"])
print(f"  thêm {them_hm} hạng mục")

# ------------------------------------------------------- số liệu cụm và FT
print("\n-- số liệu cụm / FT")
live_so = {(k[0], k[1], k[2], k[3], k[4]): v for k, v in live["so_lieu"].items()}
da_ghi, da_sua, giu = 0, 0, 0
for (ma_loc, hm_loc, ky, cum, ft), x in sorted(loc["so_lieu"].items()):
    ma = anh_xa_dv.get(ma_loc)
    hm = anh_xa_hm.get(hm_loc)
    if not ma or not hm:
        continue
    than = {"category": ma, "item": hm, "period": ky, "center": cum,
            "plan_qty": x.get("plan_qty") or 0, "done_qty": x.get("done_qty") or 0,
            "bkk_qty": x.get("bkk_qty") or 0, "note": x.get("note") or ""}
    cu = live_so.get((ma, hm, ky, cum, ft or ""))
    giong = cu and all(abs((cu.get(k) or 0) - (than[k] or 0)) < 0.001
                       for k in ("plan_qty", "done_qty", "bkk_qty")) and (cu.get("note") or "") == than["note"]
    if giong:
        giu += 1
        continue
    if ft:
        than["ft_name"] = ft
        if cu:
            ghi(L, "put", f"/progress/ft/{cu['id']}", than); da_sua += 1
        else:
            ghi(L, "post", "/progress/ft", than); da_ghi += 1
    else:
        if cu:
            ghi(L, "put", f"/progress/centers/{cu['id']}", than); da_sua += 1
        else:
            ghi(L, "post", "/progress/centers", than); da_ghi += 1
print(f"  thêm {da_ghi}, sửa {da_sua}, giữ nguyên {giu}")

# thừa: dòng số liệu live không còn trong local
nguoc = {(anh_xa_dv.get(k[0]), anh_xa_hm.get(k[1]), k[2], k[3], k[4] or "") for k in loc["so_lieu"]}
thua_so = [(k, v) for k, v in live_so.items() if k not in nguoc]
print(f"  live còn {len(thua_so)} dòng số liệu không có ở local"
      + (" — sẽ xóa" if XOA_THUA else " — giữ nguyên (thêm --xoa-thua để dọn)"))
if XOA_THUA:
    for k, v in thua_so:
        ghi(L, "delete", ("/progress/ft/" if k[4] else "/progress/centers/") + str(v["id"]))

# ------------------------------------------------------------- hoàn công
print("\n-- hoàn công")
o_hc = 0
for (ma_loc, ky), d in loc["hoan_cong"].items():
    ma = anh_xa_dv.get(ma_loc)
    if not ma:
        continue
    o = [{"nhom": g["nhom"], "trang_thai": t["trang_thai"], "sl_mct": t.get("sl_mct") or 0,
          "cong_no": t.get("cong_no") or 0, "note": t.get("note") or ""}
         for g in d.get("nhom", []) for t in g.get("trang_thai", [])
         if (t.get("sl_mct") or t.get("cong_no") or t.get("note"))]
    if not o:
        continue
    o_hc += len(o)
    ghi(L, "put", f"/hoan-cong/{ma}/nhieu", {"period": ky, "o": o})
print(f"  {o_hc} ô")

# ---------------------------------------------------------------- dự án
print("\n-- dự án")
dong_da = 0
BUOC = ("khao_sat", "phan_bo", "lap_dat", "nghiem_thu", "ban_ve", "ky_bbbg", "ky_bb_xn")
for (ma_loc, ky), d in loc["du_an"].items():
    ma = anh_xa_dv.get(ma_loc)
    if not ma:
        continue
    for i, r in enumerate(d.get("dong", [])):
        than = {"period": ky, "don_vi": r["don_vi"], "khoi": r.get("khoi") or "",
                "order_no": i, "tong_trien_khai": r.get("tong_trien_khai") or 0,
                "note": r.get("note") or ""}
        than.update({b: r.get(b) or 0 for b in BUOC})
        ghi(L, "put", f"/du-an/{ma}", than)
        dong_da += 1
print(f"  {dong_da} đơn vị")

# --------------------------------------------------------- phần live thừa
print("\n-- phần live không có ở local")
dv_thua = [c for c in live["dau_viec"] if c["id"] not in set(anh_xa_dv.values())]
print(f"  {len(dv_thua)} đầu việc: " + ", ".join(c["label"] for c in dv_thua[:12]))
print(f"  {len(live['nhiem_vu'])} nhiệm vụ kiểu cũ")
if XOA_THUA:
    for t in live["nhiem_vu"]:
        ghi(L, "delete", f"/tech-tasks/{t['id']}")
    if dv_thua:
        ghi(L, "post", "/tech-tasks/categories/xoa-nhieu", {"ma": [c["id"] for c in dv_thua]})
    print("  đã dọn (nhiệm vụ vào thùng rác)")
else:
    print("  giữ nguyên — thêm --xoa-thua nếu muốn live giống hệt local")

# ------------------------------------------------------------- đối chiếu
if not THAT:
    print("\n(mới chạy thử — thêm --that để ghi thật)")
    raise SystemExit(0)

print("\n-- đọc lại live và so từng giá trị")
sau = doc_het(L)
sau_so = {(k[0], k[1], k[2], k[3], k[4] or ""): v for k, v in sau["so_lieu"].items()}
lech, dem = [], 0
for (ma_loc, hm_loc, ky, cum, ft), x in loc["so_lieu"].items():
    ma, hm = anh_xa_dv.get(ma_loc), anh_xa_hm.get(hm_loc)
    y = sau_so.get((ma, hm, ky, cum, ft or ""))
    dem += 3
    if not y:
        lech.append(f"thiếu dòng {ma}/{cum}/{ft or '—'} kỳ {ky}")
        continue
    for k in ("plan_qty", "done_qty", "bkk_qty"):
        if abs((x.get(k) or 0) - (y.get(k) or 0)) > 0.001:
            lech.append(f"{ma}/{cum}/{ft or '—'} {k}: local {x.get(k)} ≠ live {y.get(k)}")

nhan_sau = {c["id"]: c for c in sau["dau_viec"]}
for c in loc["dau_viec"]:
    y = nhan_sau.get(anh_xa_dv.get(c["id"], ""))
    dem += 2
    if not y:
        lech.append(f"thiếu đầu việc {c['label']}")
        continue
    if y["label"] != c["label"]:
        lech.append(f"tên đầu việc: local {c['label']!r} ≠ live {y['label']!r}")
    if (y.get("group") or "") != anh_xa_nhom.get(c.get("group") or "", ""):
        lech.append(f"nhóm của “{c['label']}”: local {c.get('group')!r} ≠ live {y.get('group')!r}")

for (ma_loc, ky), d in loc["hoan_cong"].items():
    y = sau["hoan_cong"].get((anh_xa_dv.get(ma_loc), ky)) or {}
    b = {(g["nhom"], t["trang_thai"]): t for g in y.get("nhom", []) for t in g.get("trang_thai", [])}
    for g in d.get("nhom", []):
        for t in g.get("trang_thai", []):
            dem += 2
            z = b.get((g["nhom"], t["trang_thai"])) or {}
            for k in ("sl_mct", "cong_no"):
                if abs((t.get(k) or 0) - (z.get(k) or 0)) > 0.001:
                    lech.append(f"hoàn công {ma_loc} n{g['nhom']}/{t['trang_thai']} {k}: "
                                f"local {t.get(k)} ≠ live {z.get(k)}")

for (ma_loc, ky), d in loc["du_an"].items():
    y = sau["du_an"].get((anh_xa_dv.get(ma_loc), ky)) or {}
    b = {r["don_vi"]: r for r in y.get("dong", [])}
    for r in d.get("dong", []):
        z = b.get(r["don_vi"]) or {}
        for k in ("tong_trien_khai",) + BUOC:
            dem += 1
            if abs((r.get(k) or 0) - (z.get(k) or 0)) > 0.001:
                lech.append(f"dự án {r['don_vi']} {k}: local {r.get(k)} ≠ live {z.get(k)}")

print(f"Đã so {dem} giá trị.")
for x in lech[:25]:
    print("  LỆCH:", x)
print("KẾT LUẬN:", "khớp hoàn toàn" if not lech else f"còn {len(lech)} chỗ lệch")
print(f"Bản live trước khi đồng bộ vẫn nằm ở: {SAO_LUU}")
