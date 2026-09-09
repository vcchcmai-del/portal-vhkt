"""
Phân quyền chi tiết theo từng module cho từng tài khoản.

Nguyên tắc:
- Quản trị viên (admin) luôn có toàn quyền, không cần cấu hình gì thêm.
- Biên tập viên (editor) và Nhân viên (staff) chỉ được vào những module đã
  cấp cho ĐÚNG tài khoản đó. Mặc định khi tạo tài khoản mới, hệ thống gán
  sẵn ROLE_DEFAULT_PERMISSIONS cho role tương ứng, nhưng quản trị viên có
  thể bật/tắt riêng từng module cho từng người ở màn hình Quản lý tài khoản.
"""
import json

from fastapi import Depends, HTTPException

from .auth import current_user
from .models import User

# (mã module, tên hiển thị) — dùng cho ô chọn quyền và bộ lọc nhật ký.
MODULES = [
    ("news", "Quản lý bản tin"),
    ("notices", "Quản lý thông báo"),
    ("banners", "Quản lý banner"),
    ("apps", "Quản lý ứng dụng"),
    ("documents", "Quản lý tài liệu"),
    ("people", "Quản lý nhân viên"),
    ("events", "Góc văn hoá & Lịch công tác"),
    ("media", "Album ảnh và video"),
    ("sheets", "Nguồn dữ liệu Sheet"),
    ("dashboard", "Quản lý dữ liệu dashboard"),
    ("uploads", "Tải ảnh/tệp lên"),
    ("operations", "Sự cố, WO & bàn giao ca"),
    ("duty_roster", "Lịch trực vận hành"),
    ("recruitment", "Quản lý tuyển dụng"),
    ("tech_tasks", "Quản lý công việc kỹ thuật"),
    ("csdl_ht", "Tra cứu CSDL hạ tầng"),
]
MODULE_IDS = {m[0] for m in MODULES}
MODULE_LABELS = dict(MODULES)

# Mỗi nhóm dữ liệu nhập hàng loạt (bulkimport.KINDS) đi theo đúng quyền của
# module quản lý nội dung đó — không còn một quyền "import" chung áp cho mọi
# loại dữ liệu, để cấp quyền nhập số liệu dashboard không kéo theo quyền nhập
# tài khoản/nhân viên và ngược lại. "users" luôn chỉ quản trị viên (không có
# module riêng cho tài khoản trong danh sách gán được).
IMPORT_KIND_MODULE = {
    "users": None,           # chỉ quản trị viên — kiểm tra riêng, không qua module
    "people": "people",
    "schedule": "events",
    "metrics": "dashboard",
    "candidates": "recruitment",
    "center_staffing": "recruitment",
    "incidents": "operations",
    "work_orders": "operations",
    "handovers": "operations",
    "progress": "tech_tasks",
}

# Các module chỉ quản trị viên mới vào được, không gán riêng cho tài khoản khác.
ADMIN_ONLY_MODULES = [
    ("users", "Quản lý tài khoản"),
    ("config", "Cấu hình website"),
    ("notifications", "Cài đặt thông báo"),
    ("forum", "Trao đổi nội bộ"),
    ("diagnostics", "Kiểm tra hệ thống"),
    ("logs", "Nhật ký hệ thống"),
    ("auth", "Đăng nhập / mật khẩu"),
]

# Nhãn hiển thị gộp cả module gán được cho tài khoản lẫn module chỉ-admin,
# dùng cho màn hình Nhật ký hệ thống và email cảnh báo.
ALL_MODULE_LABELS = {**MODULE_LABELS, **dict(ADMIN_ONLY_MODULES)}

ACTIONS = ("view", "create", "update", "delete")
ACTION_LABELS = {
    "view": "xem", "create": "thêm", "update": "sửa", "delete": "xóa",
}
FULL_ACCESS = list(ACTIONS)

# Quyền mặc định chỉ là điểm xuất phát. Quản trị viên có thể ghi đè riêng từng
# thao tác của từng module cho mỗi tài khoản tại màn hình Quản lý tài khoản.
ROLE_DEFAULT_PERMISSIONS = {
    "admin": {m[0]: FULL_ACCESS for m in MODULES},
    "editor": {
        "news": FULL_ACCESS,
        "documents": FULL_ACCESS,
        "uploads": ["view", "create", "delete"],
    },
    "staff": {},
}


def normalize_permissions(value) -> dict:
    """Chuẩn hóa quyền về {module: [view, create, update, delete]}.

    Dữ liệu cũ là danh sách module vẫn được hiểu là toàn quyền module đó, để
    nâng cấp không làm các tài khoản cũ đột ngột mất quyền.
    """
    if not value:
        return {}
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return {}
    if isinstance(value, list):
        return {item: list(FULL_ACCESS) for item in value if item in MODULE_IDS}
    if not isinstance(value, dict):
        return {}
    clean = {}
    for module_id, actions in value.items():
        if module_id not in MODULE_IDS or not isinstance(actions, list):
            continue
        allowed = [action for action in ACTIONS if action in actions]
        # Muốn thêm/sửa/xóa thì phải nhìn thấy module đó trong menu trước.
        if any(action != "view" for action in allowed) and "view" not in allowed:
            allowed.insert(0, "view")
        if allowed:
            clean[module_id] = allowed
    return clean


def parse_permissions(raw) -> dict:
    return normalize_permissions(raw)


def dump_permissions(items) -> str:
    return json.dumps(normalize_permissions(items), ensure_ascii=False)


def effective_permission_matrix(user: User) -> dict:
    if user.role == "admin":
        return {module_id: list(FULL_ACCESS) for module_id in MODULE_IDS}
    if user.permissions is not None:
        return parse_permissions(user.permissions)
    return normalize_permissions(ROLE_DEFAULT_PERMISSIONS.get(user.role, {}))


def get_permissions(user: User) -> set:
    """Các module hiện trong menu quản trị (có quyền xem)."""
    return {
        module_id for module_id, actions in effective_permission_matrix(user).items()
        if "view" in actions
    }


def effective_permissions_list(user: User) -> list:
    return sorted(get_permissions(user))


def require_module(module_id: str, action: str = "view"):
    """Chỉ cho phép đúng thao tác đã được cấp trên module tương ứng."""
    if module_id not in MODULE_IDS:
        raise ValueError(f"Module không hợp lệ: {module_id}")
    if action not in ACTIONS:
        raise ValueError(f"Thao tác không hợp lệ: {action}")

    def checker(user: User = Depends(current_user)) -> User:
        if action not in effective_permission_matrix(user).get(module_id, []):
            raise HTTPException(
                status_code=403,
                detail=(f"Tài khoản không có quyền {ACTION_LABELS[action]} "
                        f"ở mục “{MODULE_LABELS[module_id]}”."),
            )
        return user

    return checker


def check_import_kind_permission(user: User, kind: str, action: str = "view") -> None:
    """Kiểm tra quyền nhập/xem một nhóm dữ liệu Excel theo đúng module quản lý
    nội dung đó (xem IMPORT_KIND_MODULE) — dùng trong thân hàm xử lý vì `kind`
    thường nằm trong nội dung gửi lên (body), không lấy được qua Depends().
    """
    module_id = IMPORT_KIND_MODULE.get(kind)
    if module_id is None:
        # "users" (không có module riêng) hoặc kind lạ — chỉ quản trị viên.
        if user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail="Chỉ quản trị viên được thao tác với nhóm dữ liệu này.",
            )
        return
    if action not in effective_permission_matrix(user).get(module_id, []):
        raise HTTPException(
            status_code=403,
            detail=(f"Tài khoản không có quyền {ACTION_LABELS[action]} "
                    f"ở mục “{MODULE_LABELS[module_id]}”."),
        )
