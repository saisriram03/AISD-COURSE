from fastapi import APIRouter, Depends, HTTPException, status
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.base import get_db
from app.models.scheduling import Batch, Department, Faculty, University, User
from app.schemas.scheduling import (
    DemoLoginRequest,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RegisterRequest,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _serialize_user(db: Session, user: User) -> UserOut:
    univ = db.get(University, user.university_id)
    dept = db.get(Department, user.department_id) if user.department_id else None
    batch = db.get(Batch, user.batch_id) if user.batch_id else None
    return UserOut(
        id=user.id,
        email=user.email,
        fullName=user.full_name,
        role=user.role,  # type: ignore[arg-type]
        universityId=user.university_id,
        universityName=univ.name if univ else "University",
        departmentId=user.department_id,
        departmentName=dept.name if dept else None,
        facultyId=user.faculty_id,
        batchId=user.batch_id,
        batchLabel=batch.name if batch else None,
        isActive=user.is_active,
        avatarInitials=user.avatar_initials,
    )


def _issue_login_response(db: Session, user: User) -> LoginResponse:
    access_token, expires_in = create_access_token(
        user.id,
        extra_claims={
            "role": user.role,
            "university_id": user.university_id,
            "department_id": user.department_id,
        },
    )
    refresh_token = create_refresh_token(user.id)
    return LoginResponse(
        user=_serialize_user(db, user),
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact your administrator.",
        )
    return _issue_login_response(db, user)


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> LoginResponse:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please sign in instead.",
        )

    univ = db.scalar(select(University).limit(1))
    dept = db.scalar(select(Department).where(Department.code == "CSE").limit(1)) or db.scalar(
        select(Department).limit(1)
    )
    if not univ or not dept:
        raise HTTPException(status_code=500, detail="University tenant is not initialized.")

    faculty_id: str | None = None
    batch_id: str | None = None

    if payload.role == "FACULTY":
        # Create a linked faculty profile so Admin can assign classes to this user immediately
        fac_code = f"FAC-{abs(hash(payload.email)) % 10000:04d}"
        fac = Faculty(
            department_id=dept.id,
            employee_code=fac_code,
            name=payload.full_name,
            email=payload.email,
            designation="Faculty Member",
            qualifications="M.Tech / Ph.D.",
            max_weekly_hours=18,
        )
        db.add(fac)
        db.flush()
        faculty_id = fac.id
    elif payload.role == "STUDENT":
        batch = db.scalar(select(Batch).where(Batch.department_id == dept.id).limit(1))
        batch_id = batch.id if batch else None

    parts = [p for p in payload.full_name.strip().split() if p]
    initials = "".join(p[0].upper() for p in parts[:2]) or "US"

    new_user = User(
        email=payload.email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        university_id=univ.id,
        department_id=dept.id,
        faculty_id=faculty_id,
        batch_id=batch_id,
        is_active=True,
        avatar_initials=initials,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return _issue_login_response(db, new_user)


@router.post("/demo-login", response_model=LoginResponse)
def demo_login(payload: DemoLoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    settings = get_settings()
    if not settings.is_demo_allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo login is disabled outside development mode.",
        )
    user = db.scalar(select(User).where(User.role == payload.role, User.is_active.is_(True)))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No demo account seeded for role {payload.role}.",
        )
    return _issue_login_response(db, user)


@router.post("/refresh", response_model=LoginResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)) -> LoginResponse:
    try:
        decoded = decode_token(payload.refresh_token)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        ) from exc

    if decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token type.",
        )
    user = db.get(User, decoded.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer active.",
        )
    return _issue_login_response(db, user)


@router.post("/logout")
def logout() -> dict[str, str]:
    return {"status": "logged_out"}


@router.get("/me", response_model=UserOut)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    return _serialize_user(db, current_user)
