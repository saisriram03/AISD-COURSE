from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models.scheduling import Notification, User
from app.schemas.scheduling import NotificationOut

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[NotificationOut]:
    dept_id = current_user.department_id or "dept-cse"
    items = db.scalars(
        select(Notification)
        .where(Notification.department_id == dept_id)
        .order_by(desc(Notification.created_at))
        .limit(30)
    ).all()
    return [NotificationOut.model_validate(item) for item in items]


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    item = db.get(Notification, notification_id)
    if item:
        item.is_read = True
        db.commit()
    return {"status": "read"}
