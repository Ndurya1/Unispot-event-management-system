import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import engine


try:
    with engine.connect() as connection:
        print("Database connection successful!")
except Exception as e:
    print("Database connection failed:")
    print(e)
