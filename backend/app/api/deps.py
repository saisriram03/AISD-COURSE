from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.base import get_db
from app.models.scheduling import Department, User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    try:
        payload = decode_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
        ) from exc

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
        )

    user_id = payload.get("sub")
    user = db.get(User, user_id) if user_id else None
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive or no longer exists.",
        )
    return user


def require_roles(*roles: str):
    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorized for this resource.",
            )
        return current_user

    return _dependency


require_super_admin = require_roles("SUPER_ADMIN")
require_department_admin = require_roles("DEPT_ADMIN")
require_faculty = require_roles("FACULTY")
require_student = require_roles("STUDENT")


def require_department_access(
    department_id: str,
    current_user: User,
    db: Session,
) -> Department:
    """
    Enforces strict department-level and university-level isolation.
    - SUPER_ADMIN can access any department within their university.
    - DEPT_ADMIN, FACULTY, and STUDENT can ONLY access their assigned department.
    """
    dept = db.get(Department, department_id)
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found.")

    if dept.university_id != current_user.university_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-university access is forbidden.",
        )

    if current_user.role != "SUPER_ADMIN" and current_user.department_id != department_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access another department's resources.",
        )

    return dept
