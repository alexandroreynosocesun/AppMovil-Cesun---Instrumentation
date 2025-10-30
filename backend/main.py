from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn

from app.database import get_db, engine
from app.models import models
from app.routers import auth, jigs, validations, admin, jigs_ng, registro

# Crear tablas de la base de datos
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sistema de Validación de Jigs",
    description="API para digitalizar validaciones de jigs",
    version="1.0.0"
)

# Configurar CORS para permitir conexiones desde la app móvil
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios exactos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(auth.router, prefix="/api/auth", tags=["autenticación"])
app.include_router(jigs.router, prefix="/api/jigs", tags=["jigs"])
app.include_router(validations.router, prefix="/api/validations", tags=["validaciones"])
app.include_router(admin.router, prefix="/api/admin", tags=["administración"])
app.include_router(jigs_ng.router, prefix="/api/jigs-ng", tags=["jigs-ng"])
app.include_router(registro.router, prefix="/api/registro", tags=["registro"])

@app.get("/")
async def root():
    return {"message": "Sistema de Validación de Jigs API"}

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "API funcionando correctamente"}

@app.get("/api/health")
async def api_health_check():
    return {"status": "ok", "message": "API funcionando correctamente"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
