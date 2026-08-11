"""Khởi tạo tối thiểu tài khoản quản trị.

Tách khỏi seed dữ liệu mẫu để tài khoản đăng nhập vẫn được tạo nếu CSDL đã có
sẵn danh bạ/dữ liệu nhưng chưa có bảng users hoặc bị thiếu tài khoản.
"""
import os
from .auth import hash_password
from .database import SessionLocal
from . import models as m

DEFAULT_PASSWORD = os.getenv("ADMIN_INITIAL_PASSWORD", "viettel@2026")


def ensure_accounts():
    db = SessionLocal()
    try:
        admin = db.query(m.User).filter(m.User.username == "admin").first()
        if not admin:
            person = db.query(m.Person).filter(m.Person.full_name == "Quản trị hệ thống").first()
            if not person:
                person = m.Person(
                    full_name="Quản trị hệ thống",
                    role="Quản trị hệ thống",
                    dept="Ban Quản trị Portal",
                    phone="",
                    email="",
                    color="#C8102E",
                )
                db.add(person)
                db.flush()
            admin = m.User(
                username="admin",
                password_hash=hash_password(DEFAULT_PASSWORD),
                full_name="Quản trị hệ thống",
                role="admin",
                person_id=person.id,
            )
            db.add(admin)

        # Các tài khoản mẫu cũng chỉ tạo nếu chưa tồn tại; không ghi đè mật khẩu
        # của người dùng đã đổi.
        samples = [
            ("luongdv", "Đoàn Văn Lương", "editor", "Phụ trách Cổng thông tin"),
            ("linhbn", "Bùi Nhật Linh", "staff", "Kỹ sư vận hành khai thác"),
        ]
        for username, full_name, role, person_role in samples:
            if db.query(m.User).filter(m.User.username == username).first():
                continue
            person = db.query(m.Person).filter(m.Person.full_name == full_name).first()
            if not person:
                person = m.Person(
                    full_name=full_name,
                    role=person_role,
                    dept="",
                    color="#C8102E",
                )
                db.add(person)
                db.flush()
            db.add(m.User(
                username=username,
                password_hash=hash_password(DEFAULT_PASSWORD),
                full_name=full_name,
                role=role,
                person_id=person.id,
            ))

        db.commit()
    finally:
        db.close()
