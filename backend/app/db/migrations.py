from sqlalchemy import Boolean, DateTime, Integer, String, Text, inspect, text
from sqlalchemy.engine import Engine

from app.db.base import Base


def _sql_column_def(col) -> str:
    col_type = col.type
    if isinstance(col_type, Boolean):
        default_val = "1" if (col.default and col.default.arg is True) else "0"
        return f"BOOLEAN NOT NULL DEFAULT {default_val}"
    if isinstance(col_type, Integer):
        if col.default and isinstance(col.default.arg, int):
            return f"INTEGER NOT NULL DEFAULT {col.default.arg}"
        return "INTEGER"
    if isinstance(col_type, DateTime):
        return "DATETIME"
    if isinstance(col_type, Text):
        return "TEXT NOT NULL DEFAULT ''"
    if isinstance(col_type, String):
        length = col_type.length or 255
        if col.nullable:
            return f"VARCHAR({length})"
        default_arg = col.default.arg if (col.default and isinstance(col.default.arg, str)) else ""
        escaped = default_arg.replace("'", "''")
        return f"VARCHAR({length}) NOT NULL DEFAULT '{escaped}'"
    return "TEXT"


def ensure_schema_columns(engine: Engine) -> None:
    """
    Safely adds any missing columns across all SQLAlchemy-mapped tables when upgrading an existing
    SQLite/PostgreSQL database without dropping existing data.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            if table_name not in existing_tables:
                continue
            existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
            for col in table.columns:
                if col.name not in existing_cols:
                    col_def = _sql_column_def(col)
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_def}"))
