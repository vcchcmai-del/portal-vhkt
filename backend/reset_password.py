#!/usr/bin/env python3
"""
CỨU TÀI KHOẢN — đặt lại mật khẩu khi không đăng nhập được.

Dùng khi:
  - Quên mật khẩu quản trị viên.
  - Đăng nhập báo "Sai tài khoản hoặc mật khẩu" dù gõ đúng
    (thường do SECRET_KEY bị đổi sau khi dữ liệu đã tạo).

Cách chạy — đứng tại thư mục backend:

    # Xem danh sách tài khoản đang có
    python reset_password.py --list

    # Đặt lại mật khẩu
    python reset_password.py admin MatKhauMoi2026

    # Tạo mới tài khoản quản trị nếu lỡ xoá hết
    python reset_password.py admin MatKhauMoi2026 --create

Trên Windows, nếu dữ liệu để ở ổ D thì chỉ định thêm:

    set DATABASE_URL=sqlite:///D:/portal-data/portal.db
    python reset_password.py admin MatKhauMoi2026
"""
import argparse
import os
import sys

# Cho phép chạy trực tiếp bằng "python reset_password.py"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.auth import hash_password          # noqa: E402
from app.database import SessionLocal       # noqa: E402
from app.models import User                 # noqa: E402

ROLES = {"admin": "Quản trị viên", "editor": "Biên tập viên", "staff": "Nhân viên"}


def show_db():
    print(f"Cơ sở dữ liệu: {os.getenv('DATABASE_URL', 'sqlite mặc định trong thư mục hiện tại')}\n")


def list_users(db):
    users = db.query(User).order_by(User.id).all()
    if not users:
        print("Chưa có tài khoản nào trong cơ sở dữ liệu.")
        print("Tạo tài khoản quản trị bằng lệnh:")
        print("    python reset_password.py admin MatKhauMoi2026 --create")
        return
    print(f"Có {len(users)} tài khoản:\n")
    print(f"  {'Tài khoản':<18}{'Họ và tên':<28}{'Quyền'}")
    print("  " + "-" * 62)
    for u in users:
        print(f"  {u.username:<18}{(u.full_name or ''):<28}{ROLES.get(u.role, u.role)}")


def main():
    ap = argparse.ArgumentParser(description="Đặt lại mật khẩu tài khoản cổng thông tin.")
    ap.add_argument("username", nargs="?", help="Tên tài khoản cần đặt lại")
    ap.add_argument("password", nargs="?", help="Mật khẩu mới, tối thiểu 8 ký tự")
    ap.add_argument("--list", action="store_true", help="Chỉ liệt kê tài khoản đang có")
    ap.add_argument("--create", action="store_true", help="Tạo mới nếu tài khoản chưa tồn tại")
    ap.add_argument("--role", default="admin", choices=list(ROLES), help="Quyền khi tạo mới")
    args = ap.parse_args()

    show_db()
    db = SessionLocal()
    try:
        if args.list or not args.username:
            list_users(db)
            return

        if not args.password:
            print("LỖI: chưa nhập mật khẩu mới.")
            print("Ví dụ: python reset_password.py admin MatKhauMoi2026")
            sys.exit(1)

        if len(args.password) < 8:
            print("LỖI: mật khẩu phải có ít nhất 8 ký tự.")
            sys.exit(1)

        user = db.query(User).filter(User.username == args.username.lower()).first()

        if not user:
            if not args.create:
                print(f'Không tìm thấy tài khoản "{args.username}".')
                print("Xem danh sách:  python reset_password.py --list")
                print("Hoặc tạo mới:   thêm tham số --create vào cuối lệnh")
                sys.exit(1)
            user = User(
                username=args.username.lower(),
                full_name=args.username,
                role=args.role,
                password_hash=hash_password(args.password),
            )
            db.add(user)
            db.commit()
            print(f'ĐÃ TẠO tài khoản "{user.username}" với quyền {ROLES[args.role]}.')
        else:
            user.password_hash = hash_password(args.password)
            user.must_change_password = True
            db.commit()
            print(f'ĐÃ ĐẶT LẠI mật khẩu cho "{user.username}" ({ROLES.get(user.role, user.role)}).')

        print(f"\n  Tài khoản: {user.username}")
        print(f"  Mật khẩu : {args.password}")
        print("\nĐăng nhập lại trên trình duyệt. Nhớ đổi mật khẩu sau khi vào được.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
