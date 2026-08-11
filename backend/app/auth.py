"""Đăng nhập bằng tài khoản nội bộ, cấp token JWT có hạn 12 giờ."""
import base64
import datetime as dt
import hashlib
import hmac
import os

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

# Đường dẫn được phép gọi dù tài khoản đang bị buộc đổi mật khẩu — nếu chặn cả
# hai đường này thì người dùng sẽ kẹt cứng, không có lối thoát.
PASSWORD_CHANGE_EXEMPT_PATHS = {"/api/auth/me", "/api/auth/change-password"}

SECRET_KEY = os.getenv("SECRET_KEY", "doi-chuoi-nay-truoc-khi-chay-that")
ALGORITHM = "HS256"
TOKEN_HOURS = 12

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


PBKDF2_ROUNDS = 200_000


def hash_password(raw: str) -> str:
    """
    Băm mật khẩu bằng PBKDF2 với muối ngẫu nhiên riêng cho từng tài khoản.

    Quan trọng: hàm này KHÔNG phụ thuộc SECRET_KEY. Nhờ vậy khi đổi SECRET_KEY
    (ví dụ triển khai sang máy khác, sinh lại khoá) thì mật khẩu vẫn dùng được.
    """
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", raw.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return "pbkdf2${}${}${}".format(
        PBKDF2_ROUNDS,
        base64.b64encode(salt).decode(),
        base64.b64encode(dk).decode(),
    )


def verify_password(raw: str, hashed: str) -> bool:
    """Kiểm tra mật khẩu. Vẫn chấp nhận dữ liệu cũ để không phải tạo lại tài khoản."""
    if not hashed:
        return False

    if hashed.startswith("pbkdf2$"):
        try:
            _, rounds, salt_b64, dk_b64 = hashed.split("$")
            dk = hashlib.pbkdf2_hmac(
                "sha256", raw.encode("utf-8"), base64.b64decode(salt_b64), int(rounds)
            )
            return hmac.compare_digest(dk, base64.b64decode(dk_b64))
        except (ValueError, TypeError):
            return False

    # Định dạng cũ (băm kèm SECRET_KEY) — giữ lại để dữ liệu cũ vẫn đăng nhập được
    legacy = hashlib.sha256((SECRET_KEY + raw).encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy, hashed)


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "name": user.full_name,
        "role": user.role,
        "exp": dt.datetime.utcnow() + dt.timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def current_user(token: str = Depends(oauth2), db: Session = Depends(get_db),
                  request: Request = None) -> User:
    err = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    )
    if not token:
        raise err
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise err
    user = db.query(User).get(int(payload["sub"]))
    if not user:
        raise err
    if (user.must_change_password and request is not None
            and request.url.path not in PASSWORD_CHANGE_EXEMPT_PATHS):
        raise HTTPException(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
            detail="Phải đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.",
        )
    return user


def current_user_optional(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> "User | None":
    """Như current_user, nhưng trả None thay vì báo lỗi khi chưa đăng nhập —
    dùng cho các API công khai vẫn cần biết "ai đang xem" (ví dụ: tự thấy bài
    của mình đang chờ duyệt)."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    return db.query(User).get(int(payload["sub"]))
