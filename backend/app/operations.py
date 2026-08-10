"""Phân hệ điều hành kỹ thuật: sự cố, WO, bàn giao ca và lịch trực."""
import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from . import models
from .auditlog import log_action
from .database import get_db
from .permissions import require_module

public_router = APIRouter(prefix="/api", tags=["Điều hành kỹ thuật"])
admin_router = APIRouter(prefix="/api/admin", tags=["Quản trị điều hành kỹ thuật"])


def _incident_out(row):
    overdue = bool(row.due_at and row.due_at < dt.datetime.now() and row.status not in ("resolved", "closed"))
    return {"id": row.id, "code": row.code, "title": row.title, "site": row.site,
            "severity": row.severity, "status": "overdue" if overdue else row.status,
            "assignee": row.assignee, "description": row.description, "resolution": row.resolution,
            "reported_at": row.reported_at, "due_at": row.due_at, "resolved_at": row.resolved_at}


def _wo_out(row):
    overdue = bool(row.due_at and row.due_at < dt.datetime.now() and row.status != "done")
    return {"id": row.id, "code": row.code, "title": row.title, "category": row.category,
            "location": row.location, "priority": row.priority,
            "status": "overdue" if overdue else row.status, "assignee": row.assignee,
            "description": row.description, "result": row.result, "created_at": row.created_at,
            "due_at": row.due_at, "completed_at": row.completed_at}


def _handover_out(row):
    return {"id": row.id, "shift_date": row.shift_date, "shift_name": row.shift_name,
            "outgoing": row.outgoing, "incoming": row.incoming, "summary": row.summary,
            "open_items": row.open_items, "risks": row.risks, "confirmed": row.confirmed,
            "created_at": row.created_at}


def _duty_out(row):
    return {"id": row.id, "duty_date": row.duty_date, "duty_type": row.duty_type,
            "shift_name": row.shift_name, "person_name": row.person_name, "phone": row.phone,
            "backup_name": row.backup_name, "note": row.note}


@public_router.get("/operations/summary")
def operations_summary(db: Session = Depends(get_db)):
    incidents = db.query(models.Incident).all()
    orders = db.query(models.WorkOrder).all()
    now = dt.datetime.now()
    return {
        "incidents_open": sum(x.status not in ("resolved", "closed") for x in incidents),
        "incidents_critical": sum(x.severity == "critical" and x.status not in ("resolved", "closed") for x in incidents),
        "wo_open": sum(x.status != "done" for x in orders),
        "wo_overdue": sum(bool(x.due_at and x.due_at < now and x.status != "done") for x in orders),
    }


@public_router.get("/incidents")
def list_incidents(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Incident)
    if status:
        q = q.filter(models.Incident.status == status)
    return [_incident_out(x) for x in q.order_by(models.Incident.reported_at.desc()).limit(100).all()]


@public_router.get("/work-orders")
def list_work_orders(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.WorkOrder)
    if status:
        q = q.filter(models.WorkOrder.status == status)
    return [_wo_out(x) for x in q.order_by(models.WorkOrder.due_at.asc(), models.WorkOrder.created_at.desc()).limit(150).all()]


@public_router.get("/handovers")
def list_handovers(db: Session = Depends(get_db)):
    return [_handover_out(x) for x in db.query(models.ShiftHandover).order_by(models.ShiftHandover.shift_date.desc(), models.ShiftHandover.id.desc()).limit(60).all()]


@public_router.get("/duty-schedules")
def list_duty_schedules(date_from: Optional[dt.date] = None, date_to: Optional[dt.date] = None, db: Session = Depends(get_db)):
    q = db.query(models.DutySchedule)
    if date_from: q = q.filter(models.DutySchedule.duty_date >= date_from)
    if date_to: q = q.filter(models.DutySchedule.duty_date <= date_to)
    return [_duty_out(x) for x in q.order_by(models.DutySchedule.duty_date, models.DutySchedule.duty_type).limit(200).all()]


class IncidentIn(BaseModel):
    code: Optional[str] = None; title: Optional[str] = None; site: Optional[str] = None
    severity: Optional[str] = None; status: Optional[str] = None; assignee: Optional[str] = None
    description: Optional[str] = None; resolution: Optional[str] = None
    reported_at: Optional[dt.datetime] = None; due_at: Optional[dt.datetime] = None; resolved_at: Optional[dt.datetime] = None


class WorkOrderIn(BaseModel):
    code: Optional[str] = None; title: Optional[str] = None; category: Optional[str] = None; location: Optional[str] = None
    priority: Optional[str] = None; status: Optional[str] = None; assignee: Optional[str] = None
    description: Optional[str] = None; result: Optional[str] = None; due_at: Optional[dt.datetime] = None; completed_at: Optional[dt.datetime] = None


class HandoverIn(BaseModel):
    shift_date: Optional[dt.date] = None; shift_name: Optional[str] = None; outgoing: Optional[str] = None; incoming: Optional[str] = None
    summary: Optional[str] = None; open_items: Optional[str] = None; risks: Optional[str] = None; confirmed: Optional[bool] = None


class DutyIn(BaseModel):
    duty_date: Optional[dt.date] = None; duty_type: Optional[str] = None; shift_name: Optional[str] = None
    person_name: Optional[str] = None; phone: Optional[str] = None; backup_name: Optional[str] = None; note: Optional[str] = None


def _get(db, model, item_id):
    row = db.get(model, item_id)
    if not row: raise HTTPException(404, "Không tìm thấy dữ liệu.")
    return row


def _apply(row, values):
    for key, value in values.items():
        if value is not None and hasattr(row, key): setattr(row, key, value)


def _next_code(db, model, prefix):
    return f"{prefix}-{dt.date.today():%y%m%d}-{db.query(model).count() + 1:03d}"


@admin_router.get("/incidents")
def admin_incidents(db: Session = Depends(get_db), _=Depends(require_module("operations", "view"))):
    return list_incidents(db=db)


@admin_router.post("/incidents")
def create_incident(data: IncidentIn, db: Session = Depends(get_db), user=Depends(require_module("operations", "create")), request: Request = None):
    row = models.Incident(code=data.code or _next_code(db, models.Incident, "SC"), title=data.title or "Sự cố chưa đặt tên", site=data.site or "",
        severity=data.severity or "medium", status=data.status or "open", assignee=data.assignee or "", description=data.description or "", resolution=data.resolution or "", reported_at=data.reported_at or dt.datetime.now(), due_at=data.due_at)
    db.add(row); db.commit(); db.refresh(row); log_action(db, user, "create", "operations", row.id, row.code, request=request); return _incident_out(row)


@admin_router.put("/incidents/{item_id}")
def update_incident(item_id: int, data: IncidentIn, db: Session = Depends(get_db), user=Depends(require_module("operations", "update")), request: Request = None):
    row = _get(db, models.Incident, item_id); _apply(row, data.model_dump(exclude_unset=True)); db.commit(); db.refresh(row); log_action(db, user, "update", "operations", row.id, row.code, request=request); return _incident_out(row)


@admin_router.delete("/incidents/{item_id}")
def delete_incident(item_id: int, db: Session = Depends(get_db), user=Depends(require_module("operations", "delete")), request: Request = None):
    row = _get(db, models.Incident, item_id); code = row.code; db.delete(row); db.commit(); log_action(db, user, "delete", "operations", item_id, code, request=request); return {"deleted": item_id}


@admin_router.get("/work-orders")
def admin_work_orders(db: Session = Depends(get_db), _=Depends(require_module("operations", "view"))): return list_work_orders(db=db)
@admin_router.post("/work-orders")
def create_work_order(data: WorkOrderIn, db: Session = Depends(get_db), user=Depends(require_module("operations", "create")), request: Request = None):
    row = models.WorkOrder(code=data.code or _next_code(db, models.WorkOrder, "WO"), title=data.title or "WO chưa đặt tên", category=data.category or "Vận hành", location=data.location or "", priority=data.priority or "normal", status=data.status or "new", assignee=data.assignee or "", description=data.description or "", result=data.result or "", due_at=data.due_at, completed_at=data.completed_at)
    db.add(row); db.commit(); db.refresh(row); log_action(db, user, "create", "operations", row.id, row.code, request=request); return _wo_out(row)
@admin_router.put("/work-orders/{item_id}")
def update_work_order(item_id: int, data: WorkOrderIn, db: Session = Depends(get_db), user=Depends(require_module("operations", "update")), request: Request = None):
    row = _get(db, models.WorkOrder, item_id); _apply(row, data.model_dump(exclude_unset=True)); db.commit(); db.refresh(row); log_action(db, user, "update", "operations", row.id, row.code, request=request); return _wo_out(row)
@admin_router.delete("/work-orders/{item_id}")
def delete_work_order(item_id: int, db: Session = Depends(get_db), user=Depends(require_module("operations", "delete")), request: Request = None):
    row = _get(db, models.WorkOrder, item_id); code = row.code; db.delete(row); db.commit(); log_action(db, user, "delete", "operations", item_id, code, request=request); return {"deleted": item_id}


@admin_router.get("/handovers")
def admin_handovers(db: Session = Depends(get_db), _=Depends(require_module("operations", "view"))): return list_handovers(db)
@admin_router.post("/handovers")
def create_handover(data: HandoverIn, db: Session = Depends(get_db), user=Depends(require_module("operations", "create")), request: Request = None):
    row = models.ShiftHandover(shift_date=data.shift_date or dt.date.today(), shift_name=data.shift_name or "Ca ngày", outgoing=data.outgoing or user.full_name, incoming=data.incoming or "", summary=data.summary or "", open_items=data.open_items or "", risks=data.risks or "", confirmed=bool(data.confirmed))
    db.add(row); db.commit(); db.refresh(row); log_action(db, user, "create", "operations", row.id, f"Bàn giao {row.shift_date}", request=request); return _handover_out(row)
@admin_router.put("/handovers/{item_id}")
def update_handover(item_id: int, data: HandoverIn, db: Session = Depends(get_db), user=Depends(require_module("operations", "update")), request: Request = None):
    row = _get(db, models.ShiftHandover, item_id); _apply(row, data.model_dump(exclude_unset=True)); db.commit(); db.refresh(row); log_action(db, user, "update", "operations", row.id, f"Bàn giao {row.shift_date}", request=request); return _handover_out(row)
@admin_router.delete("/handovers/{item_id}")
def delete_handover(item_id: int, db: Session = Depends(get_db), user=Depends(require_module("operations", "delete")), request: Request = None):
    row = _get(db, models.ShiftHandover, item_id); db.delete(row); db.commit(); log_action(db, user, "delete", "operations", item_id, "Bàn giao ca", request=request); return {"deleted": item_id}


@admin_router.get("/duty-schedules")
def admin_duty(db: Session = Depends(get_db), _=Depends(require_module("duty_roster", "view"))): return list_duty_schedules(db=db)
@admin_router.post("/duty-schedules")
def create_duty(data: DutyIn, db: Session = Depends(get_db), user=Depends(require_module("duty_roster", "create")), request: Request = None):
    row = models.DutySchedule(duty_date=data.duty_date or dt.date.today(), duty_type=data.duty_type or "technical", shift_name=data.shift_name or "Cả ngày", person_name=data.person_name or "Chưa phân công", phone=data.phone or "", backup_name=data.backup_name or "", note=data.note or "")
    db.add(row); db.commit(); db.refresh(row); log_action(db, user, "create", "duty_roster", row.id, row.person_name, request=request); return _duty_out(row)
@admin_router.put("/duty-schedules/{item_id}")
def update_duty(item_id: int, data: DutyIn, db: Session = Depends(get_db), user=Depends(require_module("duty_roster", "update")), request: Request = None):
    row = _get(db, models.DutySchedule, item_id); _apply(row, data.model_dump(exclude_unset=True)); db.commit(); db.refresh(row); log_action(db, user, "update", "duty_roster", row.id, row.person_name, request=request); return _duty_out(row)
@admin_router.delete("/duty-schedules/{item_id}")
def delete_duty(item_id: int, db: Session = Depends(get_db), user=Depends(require_module("duty_roster", "delete")), request: Request = None):
    row = _get(db, models.DutySchedule, item_id); db.delete(row); db.commit(); log_action(db, user, "delete", "duty_roster", item_id, "Lịch trực", request=request); return {"deleted": item_id}
