"""Phân hệ tuyển dụng: ứng viên do nhân viên giới thiệu hoặc bộ phận nhân sự nhập vào."""
import datetime as dt
from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from . import models
from .auditlog import log_action
from .auth import current_user
from .database import get_db
from .permissions import require_module

public_router = APIRouter(prefix="/api", tags=["Tuyển dụng"])
admin_router = APIRouter(prefix="/api/admin", tags=["Quản trị tuyển dụng"])

STATUS_LABELS = {
    "new": "Mới nộp", "reviewing": "Đang xem xét", "interview": "Đã phỏng vấn",
    "negotiating": "Đang trao đổi", "hired": "Đã tuyển", "probation": "Đã thử việc",
    "left": "Đã nghỉ", "rejected": "Từ chối",
}


def _out(row):
    return {
        "id": row.id, "full_name": row.full_name, "position": row.position,
        "position_type": row.position_type,
        "desired_location": row.desired_location, "birth_year": row.birth_year,
        "education_level": row.education_level, "major": row.major, "referrer": row.referrer,
        "status": row.status, "status_label": STATUS_LABELS.get(row.status, row.status),
        "note": row.note, "created_at": row.created_at,
    }


class CandidateIn(BaseModel):
    full_name: Optional[str] = None
    position: Optional[str] = None
    position_type: Optional[str] = None
    desired_location: Optional[str] = None
    birth_year: Optional[int] = None
    education_level: Optional[str] = None
    major: Optional[str] = None
    referrer: Optional[str] = None
    status: Optional[str] = None
    note: Optional[str] = None


@public_router.post("/recruitment/candidates")
def submit_candidate(data: CandidateIn, db: Session = Depends(get_db),
                     user=Depends(current_user), request: Request = None):
    """Người dùng đã đăng nhập giới thiệu một ứng viên."""
    if not (data.full_name or "").strip():
        raise HTTPException(400, "Chưa nhập họ và tên ứng viên.")
    if not (data.position or "").strip():
        raise HTTPException(400, "Chưa nhập vị trí ứng tuyển.")
    row = models.Candidate(
        full_name=data.full_name.strip(), position=data.position.strip(),
        position_type=(data.position_type or "").strip(),
        desired_location=(data.desired_location or "").strip(),
        birth_year=data.birth_year, education_level=(data.education_level or "").strip(),
        major=(data.major or "").strip(),
        referrer=(data.referrer or "").strip(), status="new",
    )
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "recruitment", row.id, row.full_name, request=request)
    return _out(row)


def _applications_received(db: Session, center: str, report_date):
    """
    Đếm thật số ứng viên có Khu vực mong muốn = trung tâm này, nộp trong đúng
    tháng của report_date — thay cho số nhập tay cũ, luôn khớp với danh sách
    ứng viên thực tế, admin không cần tự cập nhật.
    """
    if not center or not report_date:
        return 0
    return (db.query(models.Candidate)
            .filter(models.Candidate.desired_location == center,
                    models.Candidate.created_at >= dt.datetime(report_date.year, report_date.month, 1),
                    models.Candidate.created_at < (
                        dt.datetime(report_date.year + 1, 1, 1) if report_date.month == 12
                        else dt.datetime(report_date.year, report_date.month + 1, 1)
                    ))
            .count())


def _latest_staffing_per_center(db: Session):
    """Với mỗi trung tâm, chỉ lấy dòng có report_date mới nhất (số liệu hiện hành)."""
    rows = db.query(models.CenterStaffing).order_by(models.CenterStaffing.report_date.desc()).all()
    latest = {}
    for r in rows:
        if r.center not in latest:
            latest[r.center] = r
    return list(latest.values())


@public_router.get("/recruitment/summary")
def recruitment_summary(db: Session = Depends(get_db)):
    """
    Số liệu tổng hợp cho mọi người dùng — không lộ danh sách chi tiết (họ tên,
    người giới thiệu...), chỉ đếm theo vị trí / khu vực / trạng thái, và bức
    tranh định biên thiếu theo từng trung tâm (số liệu chính thức, không phải suy đoán).
    """
    rows = db.query(models.Candidate).all()
    by_position = Counter(r.position for r in rows if r.position)
    by_location = Counter(r.desired_location for r in rows if r.desired_location)
    by_status = Counter(r.status for r in rows)
    location_rank = sorted(by_location.items(), key=lambda kv: kv[1])

    staffing_rows = _latest_staffing_per_center(db)
    staffing_rows.sort(key=lambda r: -(r.oft_gap + r.ft_gap))
    report_date = max((r.report_date for r in staffing_rows), default=None)
    apps_by_center = {r.center: _applications_received(db, r.center, r.report_date) for r in staffing_rows}

    return {
        "total": len(rows),
        "by_position": [{"label": k, "count": v} for k, v in sorted(by_position.items(), key=lambda kv: -kv[1])],
        "by_location": [{"label": k, "count": v} for k, v in sorted(by_location.items(), key=lambda kv: -kv[1])],
        "by_status": [{"status": k, "label": STATUS_LABELS.get(k, k), "count": v} for k, v in by_status.items()],
        # Khu vực có ít ứng viên nộp nhất — tín hiệu để nhận biết nơi cần bổ sung nhân sự.
        "short_staffed_locations": [{"label": k, "count": v} for k, v in location_rank[:5]],
        "staffing": {
            "report_date": report_date,
            "total_oft_gap": sum(r.oft_gap for r in staffing_rows),
            "total_ft_gap": sum(r.ft_gap for r in staffing_rows),
            "total_gap": sum(r.oft_gap + r.ft_gap for r in staffing_rows),
            "total_applications": sum(apps_by_center.values()),
            "centers": [
                {"center": r.center, "oft_gap": r.oft_gap, "ft_gap": r.ft_gap,
                 "total_gap": r.oft_gap + r.ft_gap, "applications_received": apps_by_center[r.center],
                 "report_date": r.report_date}
                for r in staffing_rows
            ],
        },
    }


def _get(db, item_id):
    row = db.get(models.Candidate, item_id)
    if not row:
        raise HTTPException(404, "Không tìm thấy ứng viên.")
    return row


def _apply(row, values):
    for key, value in values.items():
        if value is not None and hasattr(row, key):
            setattr(row, key, value)


@admin_router.get("/recruitment/candidates")
def admin_list_candidates(status: Optional[str] = None, db: Session = Depends(get_db),
                          _=Depends(require_module("recruitment", "view"))):
    q = db.query(models.Candidate)
    if status:
        q = q.filter(models.Candidate.status == status)
    return [_out(x) for x in q.order_by(models.Candidate.created_at.desc()).limit(500).all()]


@admin_router.post("/recruitment/candidates")
def admin_create_candidate(data: CandidateIn, db: Session = Depends(get_db),
                           user=Depends(require_module("recruitment", "create")), request: Request = None):
    if not (data.full_name or "").strip():
        raise HTTPException(400, "Chưa nhập họ và tên ứng viên.")
    if not (data.position or "").strip():
        raise HTTPException(400, "Chưa nhập vị trí ứng tuyển.")
    row = models.Candidate(
        full_name=data.full_name.strip(), position=data.position.strip(),
        position_type=(data.position_type or "").strip(),
        desired_location=(data.desired_location or "").strip(),
        birth_year=data.birth_year, education_level=(data.education_level or "").strip(),
        major=(data.major or "").strip(),
        referrer=(data.referrer or "").strip(), status=data.status or "new", note=data.note or "",
    )
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "recruitment", row.id, row.full_name, request=request)
    return _out(row)


@admin_router.put("/recruitment/candidates/{item_id}")
def admin_update_candidate(item_id: int, data: CandidateIn, db: Session = Depends(get_db),
                           user=Depends(require_module("recruitment", "update")), request: Request = None):
    row = _get(db, item_id)
    _apply(row, data.model_dump(exclude_unset=True))
    db.commit(); db.refresh(row)
    log_action(db, user, "update", "recruitment", row.id, row.full_name, request=request)
    return _out(row)


@admin_router.delete("/recruitment/candidates/{item_id}")
def admin_delete_candidate(item_id: int, db: Session = Depends(get_db),
                           user=Depends(require_module("recruitment", "delete")), request: Request = None):
    row = _get(db, item_id)
    full_name = row.full_name
    db.delete(row); db.commit()
    log_action(db, user, "delete", "recruitment", item_id, full_name, request=request)
    return {"deleted": item_id}


@admin_router.get("/recruitment/export")
def export_candidates_csv(db: Session = Depends(get_db), _=Depends(require_module("recruitment", "view"))):
    """Xuất toàn bộ hồ sơ ứng viên ra tệp CSV để báo cáo."""
    rows = db.query(models.Candidate).order_by(models.Candidate.created_at.desc()).all()
    header = ["Họ và tên", "Vị trí ứng tuyển", "Vị trí (OFT/FT)", "Khu vực mong muốn", "Năm sinh",
              "Trình độ", "Chuyên môn", "Người giới thiệu", "Trạng thái", "Ghi chú", "Ngày nộp"]
    lines = [",".join(header)]
    for r in rows:
        vals = [
            r.full_name or "", r.position or "", r.position_type or "", r.desired_location or "",
            str(r.birth_year or ""), r.education_level or "", r.major or "", r.referrer or "",
            STATUS_LABELS.get(r.status, r.status), r.note or "",
            r.created_at.strftime("%d/%m/%Y %H:%M") if r.created_at else "",
        ]
        lines.append(",".join('"' + str(v).replace('"', '""') + '"' for v in vals))
    content = "﻿" + "\n".join(lines) + "\n"
    return PlainTextResponse(
        content, media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="ung-vien-{models.today()}.csv"'},
    )


# --------------------------------------------------- Định biên thiếu theo trung tâm

def _staffing_out(row, db: Session):
    return {
        "id": row.id, "report_date": row.report_date, "center": row.center,
        "oft_gap": row.oft_gap, "ft_gap": row.ft_gap, "total_gap": row.oft_gap + row.ft_gap,
        "applications_received": _applications_received(db, row.center, row.report_date),
        "posted_channels": row.posted_channels,
        "school_contacts": row.school_contacts, "banners_posted": row.banners_posted,
        "banner_location": row.banner_location, "note": row.note,
    }


class StaffingIn(BaseModel):
    report_date: Optional[dt.date] = None
    center: Optional[str] = None
    oft_gap: Optional[int] = None
    ft_gap: Optional[int] = None
    posted_channels: Optional[int] = None
    school_contacts: Optional[int] = None
    banners_posted: Optional[int] = None
    banner_location: Optional[str] = None
    note: Optional[str] = None


def _get_staffing(db, item_id):
    row = db.get(models.CenterStaffing, item_id)
    if not row:
        raise HTTPException(404, "Không tìm thấy báo cáo trung tâm.")
    return row


@admin_router.get("/recruitment/staffing")
def admin_list_staffing(db: Session = Depends(get_db), _=Depends(require_module("recruitment", "view"))):
    rows = db.query(models.CenterStaffing).order_by(
        models.CenterStaffing.report_date.desc(), models.CenterStaffing.center,
    ).limit(500).all()
    return [_staffing_out(x, db) for x in rows]


@admin_router.post("/recruitment/staffing")
def admin_create_staffing(data: StaffingIn, db: Session = Depends(get_db),
                          user=Depends(require_module("recruitment", "create")), request: Request = None):
    if not (data.center or "").strip():
        raise HTTPException(400, "Chưa nhập tên trung tâm.")
    row = models.CenterStaffing(
        report_date=data.report_date or models.today(), center=data.center.strip(),
        oft_gap=data.oft_gap or 0, ft_gap=data.ft_gap or 0,
        posted_channels=data.posted_channels or 0,
        school_contacts=data.school_contacts or 0, banners_posted=data.banners_posted or 0,
        banner_location=(data.banner_location or "").strip(), note=data.note or "",
    )
    db.add(row); db.commit(); db.refresh(row)
    log_action(db, user, "create", "recruitment", row.id, row.center, request=request)
    return _staffing_out(row, db)


@admin_router.put("/recruitment/staffing/{item_id}")
def admin_update_staffing(item_id: int, data: StaffingIn, db: Session = Depends(get_db),
                          user=Depends(require_module("recruitment", "update")), request: Request = None):
    row = _get_staffing(db, item_id)
    _apply(row, data.model_dump(exclude_unset=True))
    db.commit(); db.refresh(row)
    log_action(db, user, "update", "recruitment", row.id, row.center, request=request)
    return _staffing_out(row, db)


@admin_router.delete("/recruitment/staffing/{item_id}")
def admin_delete_staffing(item_id: int, db: Session = Depends(get_db),
                          user=Depends(require_module("recruitment", "delete")), request: Request = None):
    row = _get_staffing(db, item_id)
    center = row.center
    db.delete(row); db.commit()
    log_action(db, user, "delete", "recruitment", item_id, center, request=request)
    return {"deleted": item_id}


@admin_router.get("/recruitment/staffing/export")
def export_staffing_csv(db: Session = Depends(get_db), _=Depends(require_module("recruitment", "view"))):
    """Xuất báo cáo định biên thiếu theo trung tâm ra CSV."""
    rows = db.query(models.CenterStaffing).order_by(
        models.CenterStaffing.report_date.desc(), models.CenterStaffing.center,
    ).all()
    header = ["Ngày chốt số liệu", "Trung tâm", "Thiếu OFT", "Thiếu FT", "Tổng thiếu",
              "Hồ sơ nhận trong tháng", "Đã đăng Zalo/FB/Hội nhóm (luỹ kế)",
              "Tiếp xúc trường/BCHQS (luỹ kế)", "Dán băng rôn (luỹ kế)", "Vị trí treo băng rôn", "Ghi chú"]
    lines = [",".join(header)]
    for r in rows:
        vals = [
            r.report_date.strftime("%d/%m/%Y") if r.report_date else "", r.center or "",
            str(r.oft_gap or 0), str(r.ft_gap or 0), str((r.oft_gap or 0) + (r.ft_gap or 0)),
            str(_applications_received(db, r.center, r.report_date)), str(r.posted_channels or 0),
            str(r.school_contacts or 0), str(r.banners_posted or 0),
            r.banner_location or "", r.note or "",
        ]
        lines.append(",".join('"' + str(v).replace('"', '""') + '"' for v in vals))
    content = "﻿" + "\n".join(lines) + "\n"
    return PlainTextResponse(
        content, media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="dinh-bien-trung-tam-{models.today()}.csv"'},
    )
