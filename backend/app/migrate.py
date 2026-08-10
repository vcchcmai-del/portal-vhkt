"""
Tự động cập nhật cấu trúc cơ sở dữ liệu khi khởi động.

Vì sao cần: `create_all` chỉ tạo bảng còn thiếu, KHÔNG thêm cột còn thiếu vào bảng
đã có. Khi mã nguồn được bổ sung cột mới mà cơ sở dữ liệu đang chạy vẫn là bản cũ,
mọi truy vấn chạm vào cột đó sẽ hỏng. Trên máy chủ, lỗi này thường hiện ra dưới
dạng 502 ở một vài màn hình, trong khi các màn hình khác vẫn chạy bình thường.

Cách xử lý: so sánh cấu trúc mã nguồn với cấu trúc thật trong cơ sở dữ liệu,
rồi thêm những cột còn thiếu bằng ALTER TABLE. Chỉ thêm, không bao giờ xoá hay
đổi kiểu cột, nên không có nguy cơ mất dữ liệu.
"""
import logging

from sqlalchemy import inspect, text

from .database import Base, engine

log = logging.getLogger("portal.migrate")


def _sql_type(column) -> str:
    """Đổi kiểu cột trong mã nguồn sang câu lệnh SQL của hệ quản trị đang dùng."""
    try:
        return column.type.compile(dialect=engine.dialect)
    except Exception:  # noqa: BLE001
        return "TEXT"


def _default_clause(column) -> str:
    """
    Giá trị mặc định cho các dòng đã có sẵn.

    Lưu ý về kiểu đúng/sai: SQLite chấp nhận DEFAULT 0 và DEFAULT 1 cho cột
    boolean, nhưng PostgreSQL từ chối vì lệch kiểu. Phải dùng TRUE và FALSE.
    Viết sai chỗ này thì cột không được thêm, sau đó mọi câu lệnh chạm vào cột
    đó đều hỏng — đúng kiểu lỗi khó tìm.
    """
    d = column.default
    if d is None or getattr(d, "is_callable", False):
        return ""
    val = getattr(d, "arg", None)

    if isinstance(val, bool):
        if engine.dialect.name == "sqlite":
            return f" DEFAULT {1 if val else 0}"
        return f" DEFAULT {'TRUE' if val else 'FALSE'}"

    if isinstance(val, (int, float)):
        return f" DEFAULT {val}"

    if isinstance(val, str):
        safe = val.replace("'", "''")
        return f" DEFAULT '{safe}'"

    return ""


def sync_schema(verbose: bool = True):
    """
    Đối chiếu và vá cấu trúc. Trả về danh sách việc đã làm để ghi nhật ký
    và hiển thị trong màn hình Kiểm tra hệ thống.
    """
    actions = []

    # Bước 1: tạo các bảng còn thiếu
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    # Bước 2: thêm các cột còn thiếu vào bảng đã có
    for table_name, table in Base.metadata.tables.items():
        if table_name not in existing_tables:
            actions.append({"table": table_name, "action": "created_table"})
            continue

        have = {c["name"] for c in inspector.get_columns(table_name)}
        missing = [c for c in table.columns if c.name not in have]

        for col in missing:
            ddl_co_default = (
                f'ALTER TABLE {table_name} ADD COLUMN {col.name} '
                f'{_sql_type(col)}{_default_clause(col)}'
            )
            # Nếu câu lệnh kèm giá trị mặc định bị từ chối, thử lại không kèm.
            # Thà cột có giá trị rỗng còn hơn không có cột, vì thiếu cột thì
            # mọi truy vấn chạm vào nó đều hỏng.
            ddl_khong_default = f'ALTER TABLE {table_name} ADD COLUMN {col.name} {_sql_type(col)}'

            them_duoc = False
            loi_cuoi = None
            for ddl in (ddl_co_default, ddl_khong_default):
                try:
                    with engine.begin() as conn:
                        conn.execute(text(ddl))
                    actions.append({"table": table_name, "action": "added_column",
                                    "column": col.name, "sql": ddl})
                    if verbose:
                        log.warning("Đã bổ sung cột thiếu: %s.%s", table_name, col.name)
                    them_duoc = True
                    break
                except Exception as e:  # noqa: BLE001
                    loi_cuoi = e
                    if ddl == ddl_co_default:
                        log.warning("Thêm cột %s.%s kèm giá trị mặc định không được, thử lại không kèm.",
                                    table_name, col.name)

            if not them_duoc:
                actions.append({"table": table_name, "action": "error",
                                "column": col.name, "error": str(loi_cuoi)})
                log.error("Không thêm được cột %s.%s: %s", table_name, col.name, loi_cuoi)

    if verbose and actions:
        added = [a for a in actions if a["action"] == "added_column"]
        if added:
            log.warning("Cập nhật cấu trúc: đã thêm %d cột còn thiếu.", len(added))

    return actions


def schema_report():
    """
    Báo cáo tình trạng cấu trúc, dùng cho màn hình Kiểm tra hệ thống.
    Không thay đổi gì, chỉ đọc và so sánh.
    """
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    report = []

    for table_name, table in Base.metadata.tables.items():
        if table_name not in existing:
            report.append({"bang": table_name, "trang_thai": "thieu_bang",
                           "thieu_cot": [c.name for c in table.columns]})
            continue
        have = {c["name"] for c in inspector.get_columns(table_name)}
        missing = [c.name for c in table.columns if c.name not in have]
        report.append({
            "bang": table_name,
            "trang_thai": "thieu_cot" if missing else "ok",
            "thieu_cot": missing,
            "so_cot": len(have),
        })
    return report
