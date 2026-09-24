"""
Sức khoẻ số liệu: soi chính các con số mà cổng thông tin đang dùng để báo cáo.

Vì sao cần: các màn hình báo cáo đều vẽ đẹp kể cả khi số liệu rỗng hoặc đã cũ
— biểu đồ vẫn có trục, bảng vẫn có dòng, tỷ lệ hoàn thành vẫn ra 0%. Nhìn vào
không phân biệt được "đơn vị làm chưa xong" với "chưa ai nhập số". Màn hình này
trả lời đúng câu đó: nguồn nào đang cũ, mảng nào mới có kế hoạch mà chưa có
thực hiện, khối lượng nào còn treo ở mức chi nhánh chưa chia về cụm, đầu việc
nào chưa có người chủ trì để mà đòi.

Không tạo thêm bảng nào: tất cả đọc và tính lại từ dữ liệu đang có, nên không
bao giờ lệch với các màn hình khác.
"""
import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .permissions import require_module

admin_router = APIRouter(prefix="/api/admin", tags=["Sức khoẻ số liệu"])

# Ngưỡng đánh giá độ tươi.
IM_LANG_VANG = 7        # ngày không ai cập nhật -> nhắc
IM_LANG_DO = 30         # -> báo động
TRE_KY_VANG = 1         # kỳ báo cáo trễ 1 tháng -> nhắc (bình thường vẫn chốt sau)
TRE_KY_DO = 2           # trễ từ 2 tháng -> báo động


def _muc(gia_tri: Optional[int], vang: int, do: int) -> str:
    if gia_tri is None:
        return "do"
    if gia_tri >= do:
        return "do"
    if gia_tri >= vang:
        return "vang"
    return "xanh"


def _thang_cua_ky(ky: str) -> Optional[tuple]:
    """Đổi chuỗi kỳ thành (năm, tháng) để so sánh và trừ.

    Bảng số liệu dùng vài dạng kỳ khác nhau: "2026-08" (tháng), "2026-08-05"
    (ngày) và "2026-Q3" (quý, dùng cho số tuyển dụng). So chuỗi thì "2026-Q3"
    lớn hơn mọi kỳ tháng nên bị hiểu là kỳ mới nhất, rồi không tách được ra số
    tháng — màn hình báo nguồn Dashboard "rỗng hoặc quá cũ" trong khi nó đang có
    2.480 dòng. Quy về tháng cuối của quý.
    """
    if not ky:
        return None
    phan = str(ky).split("-")
    try:
        nam = int(phan[0])
    except (ValueError, IndexError):
        return None
    if len(phan) < 2:
        return None
    hai = phan[1].strip().upper()
    if hai.startswith("Q"):
        try:
            return (nam, min(int(hai[1:]) * 3, 12))
        except ValueError:
            return None
    try:
        return (nam, int(hai))
    except ValueError:
        return None


def _ky_moi_nhat(ds_ky, chi_thang: bool = False) -> Optional[str]:
    """Kỳ mới nhất theo mốc thời gian thật, không theo thứ tự chuỗi.

    chi_thang=True thì bỏ qua kỳ dạng quý. Bảng Dashboard có vài dòng theo quý
    (số tuyển dụng "2026-Q3") nằm lẫn với hàng nghìn dòng theo tháng; quý hiện
    tại luôn trông như vừa cập nhật và che mất việc số theo tháng đã dừng từ
    tháng trước — đúng thứ màn hình này sinh ra để phát hiện.
    """
    co = []
    for k in ds_ky:
        if not k:
            continue
        if chi_thang and "Q" in str(k).upper().split("-", 1)[-1]:
            continue
        t = _thang_cua_ky(k)
        if t:
            co.append((t, k))
    return max(co)[1] if co else None


def _so_thang(ky: str, moc: dt.date) -> Optional[int]:
    """Kỳ trễ mấy tháng so với tháng của `moc`. Kỳ không đọc được thì trả None."""
    t = _thang_cua_ky(ky)
    if not t:
        return None
    # Kỳ nằm ở tương lai (chỉ tiêu đặt trước) thì coi như đúng hạn, không phải
    # "trễ âm tháng".
    return max((moc.year - t[0]) * 12 + (moc.month - t[1]), 0)


def _nguon_theo_ky(ten: str, mo_ta: str, so_dong: int, ky: Optional[str],
                   moc: dt.date, man_hinh: str) -> dict:
    tre = _so_thang(ky, moc) if ky else None
    return {"ten": ten, "mo_ta": mo_ta, "so_dong": so_dong, "ky": ky or "",
            "tre_thang": tre, "im_lang_ngay": None, "man_hinh": man_hinh,
            "muc": "do" if not so_dong else _muc(tre, TRE_KY_VANG, TRE_KY_DO)}


def _nguon_theo_ngay(ten: str, mo_ta: str, so_dong: int, luc, moc: dt.date,
                     man_hinh: str) -> dict:
    ngay = None
    if luc is not None:
        ngay = (moc - (luc.date() if isinstance(luc, dt.datetime) else luc)).days
        # Lịch trực nhập trước cho tháng sau nên mốc nằm ở tương lai; số ngày âm
        # nghĩa là dữ liệu còn mới hơn hôm nay, coi như vừa cập nhật.
        ngay = max(ngay, 0)
    return {"ten": ten, "mo_ta": mo_ta, "so_dong": so_dong, "ky": "",
            "tre_thang": None, "im_lang_ngay": ngay, "man_hinh": man_hinh,
            "muc": "do" if not so_dong else _muc(ngay, IM_LANG_VANG, IM_LANG_DO)}


@admin_router.get("/suc-khoe-so-lieu")
def suc_khoe_so_lieu(db: Session = Depends(get_db),
                     _=Depends(require_module("tech_tasks", "view"))):
    hom_nay = models.today()
    M = models

    # ---------------------------------------------------------- nguồn số liệu
    nguon = []

    ky_td = _ky_moi_nhat([r[0] for r in db.query(M.ProgressEntry.period).distinct().all()])
    nguon.append(_nguon_theo_ngay(
        "Tiến độ công việc kỹ thuật",
        f"Kế hoạch/thực hiện theo cụm, kỳ mới nhất {ky_td or '—'}",
        db.query(M.ProgressEntry).count(),
        db.query(func.max(M.ProgressEntry.updated_at)).scalar(),
        hom_nay, "Công việc → từng đầu việc"))

    nguon.append(_nguon_theo_ngay(
        "Nhiệm vụ được giao",
        "Việc giao cho từng người, có hạn xử lý",
        db.query(M.TechTask).filter(M.TechTask.deleted_at.is_(None)).count(),
        db.query(func.max(M.TechTask.updated_at)).scalar(),
        hom_nay, "Công việc → Danh sách công việc"))

    nguon.append(_nguon_theo_ngay(
        "Kế hoạch ngày của cụm",
        "Đăng ký nhân sự, trạm và việc làm trong ngày",
        db.query(M.KeHoachNgay).count(),
        db.query(func.max(M.KeHoachNgay.plan_date)).scalar(),
        hom_nay, "Công việc → Kế hoạch ngày"))

    nguon.append(_nguon_theo_ky(
        "Số liệu Dashboard",
        "KPI, WO, PAKH, nhiên liệu, rời mạng… theo tháng",
        db.query(M.Metric).count(),
        # Bỏ qua các bảng *_TARGET khi tính kỳ mới nhất: chỉ tiêu được đặt trước
        # cho cả năm (tới 2026-12) nên nếu tính cả thì nguồn luôn hiện "mới
        # nhất", che mất việc số THỰC HIỆN đã dừng lại từ mấy tháng trước.
        _ky_moi_nhat([ky for ky, bang in db.query(M.Metric.period, M.Metric.board).distinct().all()
                      if not str(bang or "").upper().endswith("_TARGET")], chi_thang=True),
        hom_nay, "Trang chủ / Dashboard"))

    nguon.append(_nguon_theo_ky(
        "CSDL hạ tầng mạng lưới",
        "Chỉ tiêu hạ tầng theo cụm, nhập từ file Excel tháng",
        db.query(M.InfraStat).count(),
        _ky_moi_nhat([r[0] for r in db.query(M.InfraStat.period).distinct().all()]),
        hom_nay, "Tra cứu CSDL hạ tầng"))

    nguon.append(_nguon_theo_ngay(
        "Định biên & tuyển dụng",
        "Số thiếu FT/OFT và hoạt động tuyển theo từng đợt chốt",
        db.query(M.CenterStaffing).count(),
        db.query(func.max(M.CenterStaffing.report_date)).scalar(),
        hom_nay, "Quản lý tuyển dụng"))

    nguon.append(_nguon_theo_ngay(
        "Lịch trực toàn chi nhánh",
        "Ca trực từng người theo ngày",
        db.query(M.DutyRosterShift).count(),
        db.query(func.max(M.DutyRosterShift.duty_date)).scalar(),
        hom_nay, "Lịch trực"))

    nguon.append(_nguon_theo_ngay(
        "Vận hành: WO, sự cố, bàn giao ca",
        "Vòng đời từng WO và sự cố, nhật ký giao ca",
        db.query(M.WorkOrder).count() + db.query(M.Incident).count()
        + db.query(M.ShiftHandover).count(),
        db.query(func.max(M.WorkOrder.created_at)).scalar(),
        hom_nay, "Sự cố, WO & bàn giao ca"))

    # ------------------------------------------------- tiến độ theo nhóm việc
    nhom_ten = {g.code: g.label for g in db.query(M.TechGroup).all()}
    cats = db.query(M.TechCategory).filter(M.TechCategory.active.is_(True)).all()
    nhom_cua = {c.code: (c.group_code or "") for c in cats}
    co_so_lieu = {r[0] for r in db.query(M.ProgressEntry.category).distinct().all()}

    theo_nhom = {}
    for c in cats:
        g = nhom_cua.get(c.code, "")
        o = theo_nhom.setdefault(g, {
            "nhom": g, "ten": nhom_ten.get(g, "Chưa xếp nhóm"),
            "kh": 0.0, "th": 0.0, "bkk": 0.0, "kh_muc_cn": 0.0,
            "so_dau_viec": 0, "thieu_so_lieu": 0, "thieu_chu_tri": 0})
        o["so_dau_viec"] += 1
        if c.code not in co_so_lieu:
            o["thieu_so_lieu"] += 1
        if not (c.owner or "").strip():
            o["thieu_chu_tri"] += 1

    for r in db.query(M.ProgressEntry).all():
        g = nhom_cua.get(r.category)
        if g is None:                      # số liệu của đầu việc đã tắt/đã xoá
            continue
        o = theo_nhom.get(g)
        if o is None:
            continue
        o["kh"] += r.plan_qty or 0
        o["th"] += r.done_qty or 0
        o["bkk"] += r.bkk_qty or 0
        if r.center == "CN":
            o["kh_muc_cn"] += r.plan_qty or 0

    ds_nhom = []
    for o in theo_nhom.values():
        phai_lam = max(o["kh"] - o["bkk"], 0)
        ds_nhom.append({
            **{k: round(v, 1) if isinstance(v, float) else v for k, v in o.items()},
            "ty_le": round(o["th"] / phai_lam, 4) if phai_lam else None,
            "ton": round(max(phai_lam - o["th"], 0), 1),
            # Tỷ lệ khối lượng còn treo ở mức chi nhánh: cao thì không đánh giá
            # được cụm nào, mọi bảng xếp hạng trung tâm đều vô nghĩa.
            "ty_le_chua_chia_cum": round(o["kh_muc_cn"] / o["kh"], 4) if o["kh"] else None,
        })
    ds_nhom.sort(key=lambda x: -x["kh"])

    # ------------------------------------------------------- việc cần làm
    tong_kh = sum(x["kh"] for x in ds_nhom)
    tong_th = sum(x["th"] for x in ds_nhom)
    tong_cn = sum(x["kh_muc_cn"] for x in ds_nhom)
    thieu_so_lieu = sum(x["thieu_so_lieu"] for x in ds_nhom)
    thieu_chu_tri = sum(x["thieu_chu_tri"] for x in ds_nhom)

    viec = []

    nhom_trang = [x for x in ds_nhom if x["kh"] > 0 and x["th"] == 0]
    if nhom_trang:
        viec.append({
            "muc": "do", "tieu_de": "Có kế hoạch nhưng chưa nhập thực hiện",
            "so_luong": len(nhom_trang),
            "chi_tiet": "; ".join(f"{x['ten']} ({x['kh']:,.0f})".replace(",", ".")
                                  for x in nhom_trang),
            "lam_gi": "Vào Công việc → từng đầu việc, nhập cột Thực hiện theo cụm. "
                      "Chưa có số này thì mọi tỷ lệ hoàn thành đều là 0% giả.",
        })

    nhom_treo = [x for x in ds_nhom
                 if x["ty_le_chua_chia_cum"] is not None and x["ty_le_chua_chia_cum"] >= 0.5]
    if nhom_treo:
        viec.append({
            "muc": "do", "tieu_de": "Khối lượng còn treo ở mức chi nhánh, chưa chia về cụm",
            "so_luong": len(nhom_treo),
            "chi_tiet": "; ".join(
                f"{x['ten']} {round(x['ty_le_chua_chia_cum'] * 100)}% ({x['kh_muc_cn']:,.0f})".replace(",", ".")
                for x in nhom_treo),
            "lam_gi": "Chuyển số từ dòng “CN — chưa chia cụm” sang từng trung tâm. "
                      "Còn treo thì không xếp hạng được cụm và khuyến nghị việc nóng "
                      "của mảng đó luôn bằng 0.",
        })

    if thieu_so_lieu:
        viec.append({
            "muc": "vang", "tieu_de": "Đầu việc chưa có số liệu nào",
            "so_luong": thieu_so_lieu,
            "chi_tiet": f"{thieu_so_lieu}/{len(cats)} đầu việc đang bật nhưng chưa có dòng "
                        f"kế hoạch nào.",
            "lam_gi": "Nhập kế hoạch cho đầu việc còn dùng; đầu việc không còn dùng thì tắt đi "
                      "để danh mục khỏi phình.",
        })

    if thieu_chu_tri:
        viec.append({
            "muc": "vang", "tieu_de": "Đầu việc chưa có người chủ trì",
            "so_luong": thieu_chu_tri,
            "chi_tiet": f"{thieu_chu_tri}/{len(cats)} đầu việc chưa ghi người chủ trì.",
            "lam_gi": "Gán chủ trì để số liệu có người chịu trách nhiệm cập nhật — "
                      "và để người đó tự sửa được, không phải chờ quản trị viên.",
        })

    cu = [n for n in nguon if n["muc"] == "do"]
    if cu:
        viec.append({
            "muc": "do", "tieu_de": "Nguồn số liệu rỗng hoặc đã quá cũ",
            "so_luong": len(cu),
            "chi_tiet": "; ".join(f"{n['ten']}"
                                  + (" (chưa có dữ liệu)" if not n["so_dong"] else
                                     f" (trễ {n['tre_thang']} tháng)" if n["tre_thang"] else
                                     f" ({n['im_lang_ngay']} ngày không cập nhật)")
                                  for n in cu),
            "lam_gi": "Nhập bù hoặc tắt màn hình đang đọc nguồn đó, đừng để báo cáo "
                      "vẽ biểu đồ từ dữ liệu rỗng.",
        })

    ky_moi = [n["ky"] for n in nguon if n["ky"]]
    if len(set(ky_moi)) > 1:
        viec.append({
            "muc": "vang", "tieu_de": "Các nguồn đang ở kỳ báo cáo khác nhau",
            "so_luong": len(set(ky_moi)),
            "chi_tiet": "; ".join(f"{n['ten']}: {n['ky']}" for n in nguon if n["ky"]),
            "lam_gi": "Khi ghép số của nhiều nguồn vào một báo cáo, ghi rõ kỳ của từng "
                      "nguồn — nếu không, người đọc mặc định hiểu là cùng một tháng.",
        })

    thu_tu = {"do": 0, "vang": 1, "xanh": 2}
    viec.sort(key=lambda x: thu_tu.get(x["muc"], 9))

    return {
        "hom_nay": hom_nay.isoformat(),
        "tong_quan": {
            "so_nguon": len(nguon),
            "nguon_do": len([n for n in nguon if n["muc"] == "do"]),
            "nguon_vang": len([n for n in nguon if n["muc"] == "vang"]),
            "tong_ke_hoach": round(tong_kh, 1),
            "tong_thuc_hien": round(tong_th, 1),
            "ty_le_thuc_hien": round(tong_th / tong_kh, 4) if tong_kh else None,
            "ty_le_chua_chia_cum": round(tong_cn / tong_kh, 4) if tong_kh else None,
            "so_dau_viec": len(cats),
            "thieu_so_lieu": thieu_so_lieu,
            "thieu_chu_tri": thieu_chu_tri,
        },
        "nguon": nguon,
        "theo_nhom": ds_nhom,
        "viec_can_lam": viec,
    }
