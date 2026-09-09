"""Apply the KPI report through August 2026 once per database.

The report supplies branch totals for Cell*h, transmission incidents and
Ksub*min. Previous records for those indicators were entered by province; the
API recognises the ``Toàn chi nhánh`` rows as the authoritative aggregate.
"""

from . import models
from .database import SessionLocal


RELEASE_KEY = "_system_dashboard_kpi_2026_08"
BRANCH_TOTAL = "Toàn chi nhánh"
MONTHS = [f"2026-{month:02d}" for month in range(1, 9)]


def _upsert(db, board, period, label, value, unit_name=None):
    row = (
        db.query(models.Metric)
        .filter(
            models.Metric.board == board,
            models.Metric.period == period,
            models.Metric.label == label,
            models.Metric.unit_name == unit_name,
        )
        .first()
    )
    if row is None:
        db.add(models.Metric(
            board=board, period=period, label=label,
            unit_name=unit_name, value=value,
        ))
    else:
        row.value = value


def apply_once():
    """Write the August report exactly once, without overwriting later edits."""
    db = SessionLocal()
    try:
        already_applied = db.query(models.SiteConfig).filter(
            models.SiteConfig.key == RELEASE_KEY,
        ).first()
        if already_applied:
            return False

        # Table 3: Cell*h, transmission incidents and Ksub*min — branch total.
        branch_indicators = (
            ("OUTPUT", "OUTPUT_TARGET", "Cell*h tổng", 147.9,
             [48.5, 27.6, 54.7, 54.2, 92.1, 125.1, 83.9, 69.4]),
            ("PAKH", "PAKH_TARGET", "Số sự cố truyền dẫn", 56.0,
             [61.0, 54.0, 54.0, 65.0, 70.0, 65.0, 68.0, 81.0]),
            ("FUEL", "FUEL_TARGET", "Ksub*min", 126.8,
             [67.4, 43.1, 64.6, 40.3, 40.3, 47.1, 53.2, 26.4]),
        )
        for board, target_board, label, target, values in branch_indicators:
            for period, value in zip(MONTHS, values):
                _upsert(db, board, period, label, value, BRANCH_TOTAL)
                _upsert(db, target_board, period, label, target, BRANCH_TOTAL)

        # Table 4: PTM maps to the existing KPI TKM labels; XLSC maps to XLCS.
        operational_indicators = (
            ("VHKT", "VHKT_TARGET", "KPI TKM 3H", 45.0,
             [69.7, 68.5, 70.0, 71.9, 69.2, 65.3, 65.9, 71.7]),
            ("VHKT", "VHKT_TARGET", "KPI TKM 10H", 75.0,
             [97.3, 98.5, 98.6, 98.8, 98.4, 98.2, 97.6, 98.0]),
            ("VHKT", "VHKT_TARGET", "KPI TKM 24H", 100.0,
             [99.7, 99.9, 99.9, 99.8, 99.7, 99.8, 99.5, 99.6]),
            ("NETWORK", "NETWORK_TARGET", "XLCS 3h", 62.0,
             [76.9, 71.5, 72.2, 75.3, 76.7, 75.3, 73.8, 72.8]),
            ("NETWORK", "NETWORK_TARGET", "XLCS 10h", 81.0,
             [97.2, 96.4, 97.0, 97.0, 97.0, 97.0, 96.9, 97.4]),
            ("NETWORK", "NETWORK_TARGET", "XLCS 24h", 100.0,
             [99.8, 99.7, 99.9, 99.5, 99.8, 99.9, 99.8, 99.6]),
        )
        for board, target_board, label, target, values in operational_indicators:
            for period, value in zip(MONTHS, values):
                _upsert(db, board, period, label, value)
                _upsert(db, target_board, period, label, target)

        db.add(models.SiteConfig(
            key=RELEASE_KEY, value="applied", label="System dashboard data release",
            kind="system",
        ))
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
