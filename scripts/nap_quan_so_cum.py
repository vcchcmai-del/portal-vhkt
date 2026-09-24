# -*- coding: utf-8 -*-
"""Nạp số FT nhà trạm của 13 cụm vào bảng quân số của màn hình Kế hoạch ngày.

Nguồn: bảng định biên nhà trạm anh Lượng gửi ngày 24/09/2026 — hai cột "Số FT
tối thiểu" và "FT hiện tại", tổng 86/80. Bảng ghi theo tên trung tâm MỚI kèm
tên CŨ; script tra ra mã cụm qua bảng infra_center_codes để không phải gõ mã
tay (Thới Hòa từng là Bến Cát - Bàu Bàng, Tam Thắng từng là Vũng Tàu...).

    set PORTAL_PASS=...
    python scripts/nap_quan_so_cum.py local          # chạy thử, không ghi
    python scripts/nap_quan_so_cum.py local --that   # ghi thật
    python scripts/nap_quan_so_cum.py live  --that

Chạy lại nhiều lần được: mỗi cụm một dòng, ghi đè chứ không đẻ dòng mới. Trước
khi ghi, script tự cộng lại hai cột và so với tổng in trên bảng — lệch thì dừng,
không ghi gì. Kiểm tra bằng số dòng thôi thì đã ba lần hỏng dữ liệu.
"""
import io
import os
import sys

import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

DICH = {"local": "http://127.0.0.1:8000", "live": "https://portal-vhkt-backend.n1.tinhgon.xyz"}
B = DICH[sys.argv[1] if len(sys.argv) > 1 else "local"]
A = f"{B}/api/admin"
THAT = "--that" in sys.argv

# (tên trung tâm như trên bảng, FT tối thiểu, FT hiện tại)
BANG = [
    ("Trung tâm Thới Hòa", 14, 12),
    ("Trung tâm Dầu Tiếng", 3, 3),
    ("Trung tâm Tân Đông Hiệp", 7, 7),
    ("Trung tâm Phú Giáo", 3, 2),
    ("Trung tâm Tân Uyên", 13, 11),
    ("Trung tâm Chánh Hiệp", 9, 8),
    ("Trung tâm Thuận Giao", 11, 10),
    ("Trung tâm Bà Rịa", 5, 4),
    ("Trung tâm Ngãi Giao", 3, 3),
    ("Trung tâm Côn Đảo", 1, 1),
    ("Trung tâm Phú Mỹ", 5, 5),
    ("Trung tâm Tam Thắng", 7, 8),
    ("Trung tâm Hồ Tràm", 5, 6),
]
TONG_TOI_THIEU, TONG_HIEN_TAI = 86, 80


def dang_nhap() -> dict:
    mat_khau = os.getenv("PORTAL_PASS")
    if not mat_khau:
        sys.exit("Chưa đặt PORTAL_PASS (mật khẩu tài khoản quản trị).")
    r = requests.post(f"{B}/api/auth/login",
                      data={"username": os.getenv("PORTAL_USER", "admin"), "password": mat_khau},
                      timeout=30)
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def main() -> None:
    tt = sum(x[1] for x in BANG)
    ht = sum(x[2] for x in BANG)
    print(f"Bảng nguồn: {len(BANG)} cụm | FT tối thiểu {tt} | FT hiện tại {ht}")
    if (tt, ht) != (TONG_TOI_THIEU, TONG_HIEN_TAI):
        sys.exit(f"DỪNG: tổng không khớp bảng gốc ({TONG_TOI_THIEU}/{TONG_HIEN_TAI}) — sửa lại BANG rồi chạy lại.")

    h = dang_nhap()
    # Tra mã cụm theo tên: dùng đúng danh mục mã cụm của hệ thống, kể cả tên cũ.
    cum = requests.get(f"{B}/api/centers", headers=h, timeout=30).json()
    tra = {}
    for c in cum:
        for ten in (c.get("name"), c.get("short"), c.get("old_name"), c.get("code")):
            if ten:
                tra[str(ten).replace("Trung tâm", "").strip(" -").casefold()] = c["code"]

    viec = []
    for ten, toi_thieu, hien_tai in BANG:
        khoa = ten.replace("Trung tâm", "").strip(" -").casefold()
        ma = tra.get(khoa)
        if not ma:
            sys.exit(f"DỪNG: không tra được mã cụm cho “{ten}”.")
        viec.append((ma, ten, toi_thieu, hien_tai))

    if len({v[0] for v in viec}) != len(viec):
        sys.exit("DỪNG: có hai dòng tra ra cùng một mã cụm.")

    for ma, ten, toi_thieu, hien_tai in viec:
        print(f"  {ma:4s} {ten:26s} tối thiểu {toi_thieu:3d} | hiện tại {hien_tai:3d}")
        if not THAT:
            continue
        r = requests.put(f"{A}/ke-hoach-ngay/nhan-su/{ma}", headers=h, timeout=30,
                         json={"ft_toi_thieu": toi_thieu, "so_nhan_su": hien_tai,
                               "ghi_chu": "Định biên nhà trạm, bảng ngày 24/09/2026"})
        r.raise_for_status()

    if not THAT:
        print("\nĐây là chạy thử. Thêm --that để ghi thật.")
        return

    # Đọc lại từ máy chủ và so từng giá trị, không chỉ đếm số dòng.
    sau = {x["center"]: x for x in requests.get(f"{A}/ke-hoach-ngay/nhan-su", headers=h, timeout=30).json()}
    lech = [f"{ma}: máy chủ {sau.get(ma, {}).get('ft_toi_thieu')}/{sau.get(ma, {}).get('so_nhan_su')}"
            f" ≠ bảng {tt_}/{ht_}"
            for ma, _ten, tt_, ht_ in viec
            if (sau.get(ma, {}).get("ft_toi_thieu"), sau.get(ma, {}).get("so_nhan_su")) != (tt_, ht_)]
    if lech:
        sys.exit("GHI XONG NHƯNG LỆCH:\n  " + "\n  ".join(lech))
    print(f"\nĐã ghi và đối chiếu xong {len(viec)} cụm — khớp từng giá trị với bảng gốc.")


if __name__ == "__main__":
    main()
