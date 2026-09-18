# -*- coding: utf-8 -*-
"""Kế hoạch tháng 09/2026 — số liệu gõ lại từ 4 bảng người dùng gửi."""

KY = "2026-09"
CUM = ["DTG", "CHP", "TDH", "THA", "PGO", "TGO", "TUN", "TTG", "HTM", "NGO", "PMY", "BRA", "CDO"]
_ = 0  # ô "-" trong bảng

# (tên đầu việc, ĐVT, tổng HCM, [số theo CUM])
TRUYEN_DAN = [
    ("Cập nhật link trên NIMS",                 "Link",  530, [13, 89, 70, 122, 13, 108, 51, 20, 15, 15, 6, 3, 5]),
    ("Giải nghẽn uplink OLT",                   "OLT",   318, [19, 15, 32, 44, 11, 41, 53, 21, 25, 16, 17, 20, 4]),
    ("Triển khai đấu nối 5G năm 2026",          "Trạm",  317, [16, 13, 15, 53, 20, 20, 88, 6, 26, 12, 21, 27, _]),
    ("Swap XGSPON năm 2026",                    "Node",   78, [_, 11, 18, 1, _, 25, 12, 6, _, _, 5, _, _]),
    ("Lắp đặt OLT, swap card GTGH sang GTGO",   "Card",   75, [_, 12, 14, _, _, 28, 10, 5, _, _, 6, _, _]),
    ("Củng cố tuyến cáp lỗi lặp trên 2 lần",    "Tuyến",  55, [4, 1, 7, 11, 5, 3, 3, 5, 1, 5, _, 10, _]),
    ("Cắt cáp dập nát",                         "Vị trí", 32, [_, _, 6, 1, _, 6, 4, 4, _, 1, 10, _, _]),
    ("Chèn SRT phát sóng trạm mới",             "Trạm",   32, [1, 4, 2, _, _, 5, 8, 5, 1, _, 1, 5, _]),
    ("Giải nghẽn ring lưu lượng cao",           "Ring",   27, [1, _, 1, 3, 1, 4, 2, 3, 3, _, 5, 4, _]),
    ("Sửa suy hao link SRT, DWDM, SDH",         "Link",   19, [1, 1, 3, 1, 1, 3, 6, 1, 1, _, 1, _, _]),
    ("Nâng cấp AGG",                            "Node",    8, [_, _, _, 1, _, 1, 1, 2, 1, _, 1, 1, _]),
    ("Tách node cố định băng rộng",             "Node",    6, [_, 1, _, _, _, 3, _, 1, _, _, _, 1, _]),
    ("Triển khai đấu nối ring 5G khép ring",    "Ring",    5, [_, _, _, _, _, _, _, 1, 1, _, 1, 2, _]),
    ("Lắp đặt ROUTER NFX150",                   "Bộ",      5, [_, _, _, _, _, _, _, 1, 2, _, _, 2, _]),
]
TRUYEN_DAN_COT = [55, 147, 168, 237, 51, 247, 238, 81, 76, 49, 74, 75, 9]

CDBR = [
    ("Nhân sự thực hiện",            "Người",  210, [6, 21, 28, 20, 6, 37, 25, 21, 13, 9, 9, 14, 1]),
    ("Củng cố THC theo TTr 4149",    "THC",    227, [8, 2, 12, 14, 6, 32, 47, 8, 27, 11, 25, 35, _]),
    ("SWAP 1BT, đổi UCTT Mesh",      "Thuê bao", 4105, [67, 32, 435, 465, 480, 719, 967, 269, 241, 240, 4, 185, 1]),
    ("Giao chỉ tiêu rớt mạng",       "Thuê bao", 3111, [87, 385, 444, 273, 76, 656, 327, 280, 160, 102, 108, 200, 13]),
    ("Port kém dưới -26 dB",         "Port",  3472, [119, 249, 450, 303, 141, 414, 469, 247, 390, 228, 157, 291, 14]),
    ("Home kém dưới -80 dB",         "Home",  2124, [36, 229, 296, 109, 27, 330, 190, 411, 98, 80, 95, 214, 9]),
    ("Home kết nối LAN 100M",        "Home",  4163, [60, 555, 644, 382, 66, 770, 313, 638, 170, 130, 164, 262, 9]),
    ("Bàn giao FTTH",                "Vị trí", 420, [12, 42, 56, 40, 12, 74, 50, 42, 26, 18, 18, 28, 2]),
]
CDBR_COT = [395, 1515, 2365, 1606, 814, 3032, 2388, 1916, 1125, 818, 580, 1229, 49]
CDBR_TONG = 17832

# Bảng 3 và 4 chỉ có cột HCM: (đầu việc, tổng, [(nhiệm vụ, khối lượng, ĐVT)])
KIEM_SOAT = [
    ("Chỉ tiêu bảo dưỡng", 2551, [
        ("Thực hiện bảo dưỡng nhà trạm", 762, "Trạm"),
        ("Bảo dưỡng tuyến cáp truyền dẫn", 1139, "Tuyến"),
        ("Bảo dưỡng THC", 650, "THC"),
    ]),
    ("Khắc phục lỗi báo hỏng", 3797, [
        ("Khắc phục lỗi báo hỏng HTML InOS", 304, "Báo hỏng"),
        ("Kiểm soát các dự án do Viettel đầu tư", 131, "Dự án"),
        ("Ký biên bản nghiệm thu XHH cho 98 trạm", 98, "Trạm"),
    ]),
    ("Chỉ tiêu kiểm tra hiện trường", 6, [
        ("Kiểm tra hiện trường nhà trạm", 0, "Trạm"),
        ("Kiểm tra hiện trường tuyến cáp truyền dẫn", 0, "Tuyến"),
        ("Kiểm tra hiện trường THC", 0, "THC"),
        ("Kế hoạch di dời trạm", 6, "Trạm"),
    ]),
]

CO_DIEN = [
    ("Bảo dưỡng điều hòa, máy phát điện, tổ hợp làm bằng", 591, "Thiết bị"),
    ("Lắp đặt thiết bị cơ điện phục vụ 5G", 318, "Thiết bị"),
    ("Giám sát thiết bị cơ điện theo kế hoạch 778", 262, "Thiết bị"),
    ("Thực hiện WO_TT", 99, "WO"),
    ("Bảo dưỡng trạm hạ tầng cho thuê", 85, "Trạm"),
    ("Lắp đặt iACV", 71, "Bộ"),
    ("Khắc phục trạm mất giám sát máy phát điện", 57, "Trạm"),
    ("Thay thế thiết bị báo hỏng trên phần mềm ICMS", 51, "Thiết bị"),
    ("Sửa chữa điều hòa, máy phát điện", 42, "Thiết bị"),
    ("Thu hồi ắc quy", 40, "Bộ"),
    ("Ký phương án ứng cứu thông tin quý IV", 37, "Phương án"),
    ("Test máy phát điện, ắc quy Pool", 28, "Thiết bị"),
    ("Hoàn thành đấu giám sát ắc quy LIB", 22, "Bộ"),
    ("Test máy phát điện trong kho", 17, "Máy"),
    ("Kiểm tra trạm đấu sai nguồn ưu tiên", 9, "Trạm"),
    ("Lắp đặt máy phát điện", 8, "Máy"),
    ("Kiểm tra trạm tồi KPI ATS", 7, "Trạm"),
    ("Triển khai lắp đặt tích hợp giám sát", 4, "Trạm"),
    ("Swap tủ nguồn DC", 4, "Tủ"),
    ("Thay thế DAQ", 2, "Bộ"),
    ("Lắp đặt ATS", 2, "Bộ"),
    ("Thu hồi ATS hỏng hẳn", 1, "Bộ"),
]
CO_DIEN_TONG = 1757


def kiem_tra():
    """Cộng lại đúng như bảng giấy trước khi cho phép nạp."""
    loi = []
    for ten, bang, cot, tong in (("Truyền dẫn", TRUYEN_DAN, TRUYEN_DAN_COT, None),
                                 ("CĐBR", CDBR, CDBR_COT, CDBR_TONG)):
        for nhan, _dv, hcm, ds in bang:
            if sum(ds) != hcm:
                loi.append(f"{ten} — “{nhan}”: cộng cụm {sum(ds)} ≠ HCM {hcm}")
        for i, ma in enumerate(CUM):
            c = sum(r[3][i] for r in bang)
            if c != cot[i]:
                loi.append(f"{ten} — cột {ma}: cộng {c} ≠ bảng {cot[i]}")
        if tong is not None and sum(r[2] for r in bang) != tong:
            loi.append(f"{ten} — tổng HCM {sum(r[2] for r in bang)} ≠ bảng {tong}")
    if sum(r[1] for r in CO_DIEN) != CO_DIEN_TONG:
        loi.append(f"Cơ điện — tổng {sum(r[1] for r in CO_DIEN)} ≠ bảng {CO_DIEN_TONG}")
    for nhan, tong, con in KIEM_SOAT:
        c = sum(x[1] for x in con)
        if c != tong:
            loi.append(f"Kiểm soát — “{nhan}”: cộng nhiệm vụ {c} ≠ bảng {tong} (chênh {tong - c})")
    return loi


if __name__ == "__main__":
    import io, sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    for x in kiem_tra():
        print("LỆCH:", x)
    print("kiểm tra xong")
