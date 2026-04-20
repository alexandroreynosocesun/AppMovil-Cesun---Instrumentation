import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('UPH_DATABASE_URL', open(os.path.join(os.path.dirname(__file__), '.env')).read().split('UPH_DATABASE_URL=')[1].split('\n')[0].strip())

from app.database_uph import uph_engine
from sqlalchemy import text

with uph_engine.connect() as conn:
    r = conn.execute(text("SELECT nombre FROM operadores LIMIT 10"))
    for row in r.fetchall():
        print(repr(row[0]))
