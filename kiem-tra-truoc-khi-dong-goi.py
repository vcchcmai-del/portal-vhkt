#!/usr/bin/env python3
"""
KIỂM TRA TRƯỚC KHI ĐÓNG GÓI

Chạy trước mỗi lần phát hành:

    python3 kiem-tra-truoc-khi-dong-goi.py

Bắt những lỗi đã từng gây sự cố thật trong quá trình triển khai:

  1. Số phiên bản giao diện và máy chủ lệch nhau
  2. docker-compose ghi đè số phiên bản bằng chuỗi cũ
  3. Bản dựng trong backend/static cũ hơn mã nguồn frontend
  4. Dockerfile chép tệp không tồn tại  (đã từng làm hỏng lần dựng v4)
  5. Tệp rác lọt vào gói
  6. Giao diện gọi đường dẫn máy chủ không có

Trả về mã 0 nếu mọi thứ đạt, mã 1 nếu có lỗi.
"""
import fnmatch
import json
import pathlib
import re
import subprocess
import sys

GOC = pathlib.Path(__file__).parent
loi = []
canh_bao = []


def dat(ten, chi_tiet=""):
    print(f"  [ĐẠT ] {ten}" + (f"  {chi_tiet}" if chi_tiet else ""))


def hong(ten, chi_tiet):
    print(f"  [LỖI ] {ten}  →  {chi_tiet}")
    loi.append(f"{ten}: {chi_tiet}")


def nhac(ten, chi_tiet):
    print(f"  [NHẮC] {ten}  →  {chi_tiet}")
    canh_bao.append(f"{ten}: {chi_tiet}")


# ------------------------------------------------------- 1. Số phiên bản
print("\n1. SỐ PHIÊN BẢN")

build_js = (GOC / "frontend/src/build.js").read_text(encoding="utf-8")
main_py = (GOC / "backend/app/main.py").read_text(encoding="utf-8")
api_js = (GOC / "frontend/src/api.js").read_text(encoding="utf-8")

m_fe = re.search(r'BUILD_ID\s*=\s*"([^"]+)"', build_js)
m_be = re.search(r'PORTAL_BUILD\s*=\s*"([^"]+)"', main_py)
m_api_be = re.search(r'API_VERSION\s*=\s*(\d+)', main_py)
m_api_fe = re.search(r'API_CAN_CO\s*=\s*(\d+)', api_js)

if not (m_fe and m_be):
    hong("Tìm số bản dựng", "thiếu BUILD_ID hoặc PORTAL_BUILD")
elif m_fe.group(1) != m_be.group(1):
    hong("Bản dựng hai phía", f"giao diện {m_fe.group(1)} ≠ máy chủ {m_be.group(1)}")
else:
    dat("Bản dựng hai phía trùng nhau", m_fe.group(1))

if not (m_api_be and m_api_fe):
    hong("Tìm số hiệu API", "thiếu API_VERSION hoặc API_CAN_CO")
elif int(m_api_be.group(1)) < int(m_api_fe.group(1)):
    hong("Số hiệu API", f"máy chủ {m_api_be.group(1)} thấp hơn mức giao diện cần {m_api_fe.group(1)}")
else:
    dat("Số hiệu API tương thích", f"máy chủ {m_api_be.group(1)}, giao diện cần {m_api_fe.group(1)}")

# --------------------------------------- 2. docker-compose không ghi đè
print("\n2. CẤU HÌNH TRIỂN KHAI")

ghi_de = []
for f in GOC.glob("docker-compose*.yml"):
    if re.search(r'^\s*PORTAL_BUILD:', f.read_text(encoding="utf-8"), re.M):
        ghi_de.append(f.name)
if ghi_de:
    hong("docker-compose ghi đè số phiên bản", ", ".join(ghi_de))
else:
    dat("Không nơi nào ghi đè số phiên bản")

# ------------------------------------------ 3. Bản dựng khớp mã nguồn
print("\n3. BẢN DỰNG GIAO DIỆN")

static = GOC / "backend/static"
assets = list((static / "assets").glob("*.js")) if (static / "assets").exists() else []

if not (static / "index.html").exists():
    hong("backend/static/index.html", "không có — giao diện sẽ không hiện")
elif not assets:
    hong("backend/static/assets", "không có tệp JavaScript nào")
else:
    js = assets[0].read_text(encoding="utf-8", errors="ignore")
    ban_dung = m_fe.group(1) if m_fe else ""
    if ban_dung and ban_dung not in js:
        hong("Bản dựng cũ hơn mã nguồn",
             f"không tìm thấy {ban_dung} trong bản dựng — cần chạy: cd frontend && npm run build")
    else:
        dat("Bản dựng chứa đúng số phiên bản", ban_dung)

    # Không được còn tệp vá DOM
    va_dom = [p.name for p in static.glob("*.js")]
    if va_dom:
        hong("Còn tệp vá DOM trong static", ", ".join(va_dom))
    else:
        dat("Không có tệp vá DOM rời")

    # index.html không được nạp tệp lạ
    html = (static / "index.html").read_text(encoding="utf-8")
    la = [s for s in re.findall(r'src="([^"]+)"', html) if "/assets/" not in s]
    if la:
        hong("index.html nạp tệp ngoài assets", ", ".join(la))
    else:
        dat("index.html chỉ nạp tệp trong assets")

# ------------------------------------------------ 4. Dockerfile hợp lệ
print("\n4. DOCKERFILE")

bo_qua = []
di = GOC / ".dockerignore"
if di.exists():
    bo_qua = [l.strip() for l in di.read_text().splitlines() if l.strip() and not l.startswith("#")]


def bi_loai(duong_dan: str):
    for luat in bo_qua:
        r = luat.rstrip("/")
        if fnmatch.fnmatch(duong_dan, r) or fnmatch.fnmatch(duong_dan, r + "/*"):
            return luat
    return None


so_hong = 0
for df in sorted(GOC.rglob("Dockerfile*")):
    if "node_modules" in str(df):
        continue
    ctx = df.parent
    for line in df.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*COPY\s+(?:--from=\S+\s+)?(\S+)\s+(\S+)", line)
        if not m or "--from=" in line:
            continue
        src = m.group(1)
        rel = str((ctx / src).relative_to(GOC)) if ctx != GOC else src
        if not (ctx / src).exists():
            hong(f"{df.relative_to(GOC)}", f"chép tệp không tồn tại: {src}")
            so_hong += 1
        elif bi_loai(rel):
            hong(f"{df.relative_to(GOC)}", f"tệp {src} bị .dockerignore loại")
            so_hong += 1
if so_hong == 0:
    dat("Mọi lệnh COPY đều trỏ tới tệp có thật")

# ------------------------------------------------------- 5. Tệp rác
print("\n5. TỆP RÁC")

rac = {
    "__pycache__": list(GOC.rglob("__pycache__")),
    "*.pyc": list(GOC.rglob("*.pyc")),
    "cơ sở dữ liệu": [p for p in GOC.rglob("*.db") if "node_modules" not in str(p)],
    "node_modules": list(GOC.glob("*/node_modules")),
    "thư mục dist": list(GOC.glob("frontend/dist")),
}
co_rac = False
for ten, ds in rac.items():
    if ds:
        nhac(f"Còn {ten}", f"{len(ds)} mục — nên xoá trước khi đóng gói")
        co_rac = True
if not co_rac:
    dat("Không có tệp rác")

# ------------------------------- 6. Giao diện gọi đường dẫn có thật
print("\n6. ĐỐI CHIẾU GIAO DIỆN VỚI MÁY CHỦ")

goi = set()
for f in (GOC / "frontend/src").glob("*.js*"):
    t = f.read_text(encoding="utf-8")
    for m in re.finditer(r'["`](/api/[^"`\s?]+)', t):
        goi.add(re.sub(r'\$\{[^}]+\}', '{x}', m.group(1)).split("?")[0])

# Danh sách đường dẫn máy chủ, đọc trực tiếp từ mã nguồn
co = set()
for f in (GOC / "backend/app").glob("*.py"):
    t = f.read_text(encoding="utf-8")

    # Mỗi biến router có thể mang tiền tố riêng (vd: public_router="/api",
    # admin_router="/api/admin" trong cùng một tệp) — phải map riêng từng biến,
    # không gộp chung theo tệp.
    tien_to = {"app": ""}
    for bien, pfx in re.findall(r'(\w+)\s*=\s*APIRouter\(\s*(?:.*?prefix\s*=\s*"([^"]*)")?', t):
        tien_to[bien] = pfx or ""

    for m in re.finditer(r'@(\w+)\.\w+\(\s*"([^"]+)"', t):
        bien, p = m.group(1), m.group(2)
        if bien not in tien_to:
            continue
        pfx = tien_to[bien]
        full = (pfx + p) if not p.startswith("/api") else p
        co.add(re.sub(r'\{[^}]+\}', '{x}', full))

thieu = []
for g in sorted(goi):
    if g in co:
        continue
    if any(g.startswith(c.rstrip("/")) or c.startswith(g.rstrip("/")) for c in co):
        continue
    thieu.append(g)

if thieu:
    for t in thieu:
        hong("Giao diện gọi đường dẫn máy chủ không có", t)
else:
    dat(f"Toàn bộ {len(goi)} đường dẫn giao diện gọi đều có ở máy chủ")

# ---------------------------------------------------------- Kết luận
print("\n" + "═" * 62)
if loi:
    print(f"  KHÔNG ĐẠT — {len(loi)} lỗi cần sửa trước khi đóng gói:")
    for x in loi:
        print(f"    · {x}")
    sys.exit(1)

print("  ĐẠT — có thể đóng gói và triển khai.")
if canh_bao:
    print(f"\n  {len(canh_bao)} điểm nhắc (không chặn):")
    for x in canh_bao:
        print(f"    · {x}")
sys.exit(0)
