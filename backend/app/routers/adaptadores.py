from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime
from ..database import get_db
from ..models.models import Adaptador, ConectorAdaptador, ValidacionAdaptador, ValidacionConector, Tecnico, ModeloMainboardConector
from ..schemas import (
    Adaptador as AdaptadorSchema,
    AdaptadorCreate,
    AdaptadorUpdate,
    ValidacionAdaptador as ValidacionAdaptadorSchema,
    ValidacionAdaptadorCreate,
    PaginatedResponse,
    ConectorAdaptador as ConectorAdaptadorSchema,
    ConectorAdaptadorUpdate,
    ConectorUsoBulkUpdate
)
from ..auth import get_current_user
from ..config.adaptadores_config import get_conectores_by_modelo, get_modelos_by_conector, get_modelos_disponibles
from ..utils.pagination import paginate_query
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

def serialize_adaptador(
    adaptador: Adaptador,
    include_conectores: bool = True,
    include_tecnicos: bool = True,
    db: Session = None
) -> dict:
    """Serializar adaptador con información relacionada"""
    result = {
        "id": adaptador.id,
        "codigo_qr": adaptador.codigo_qr,
        "numero_adaptador": adaptador.numero_adaptador,
        "modelo_adaptador": adaptador.modelo_adaptador,
        "estado": adaptador.estado,
        "es_dual_conector": adaptador.es_dual_conector if hasattr(adaptador, 'es_dual_conector') else False,
        "created_at": adaptador.created_at.isoformat() if adaptador.created_at else None,
    }
    
    if include_conectores and adaptador.conectores:
        result["conectores"] = []
        for conector in adaptador.conectores:
            conector_dict = {
                "id": conector.id,
                "nombre_conector": conector.nombre_conector,
                "estado": conector.estado,
                "fecha_estado_ng": conector.fecha_estado_ng.isoformat() if conector.fecha_estado_ng else None,
                "comentario_ng": conector.comentario_ng,
                "fecha_ultima_validacion": conector.fecha_ultima_validacion.isoformat() if conector.fecha_ultima_validacion else None,
                "linea_ultima_validacion": conector.linea_ultima_validacion,
                "turno_ultima_validacion": conector.turno_ultima_validacion,
            }
            
            # Usar las relaciones directamente en lugar de consultas adicionales
            if include_tecnicos:
                if conector.tecnico_ng:
                    conector_dict["tecnico_ng"] = {
                        "id": conector.tecnico_ng.id,
                        "nombre": conector.tecnico_ng.nombre,
                        "numero_empleado": conector.tecnico_ng.numero_empleado,
                        "usuario": conector.tecnico_ng.usuario
                    }
                
                if conector.tecnico_ultima_validacion:
                    conector_dict["tecnico_ultima_validacion"] = {
                        "id": conector.tecnico_ultima_validacion.id,
                        "nombre": conector.tecnico_ultima_validacion.nombre,
                        "numero_empleado": conector.tecnico_ultima_validacion.numero_empleado,
                        "usuario": conector.tecnico_ultima_validacion.usuario
                    }
            
            if conector.usuario_reporte_ng:
                conector_dict["usuario_reporte_ng"] = conector.usuario_reporte_ng
            
            result["conectores"].append(conector_dict)
    
    return result

@router.get("/", response_model=PaginatedResponse[dict])
async def get_adaptadores(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    modelo: Optional[str] = None,
    estado: Optional[str] = None,
    include_conectores: bool = Query(False),
    include_tecnicos: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener lista paginada de adaptadores"""
    if include_tecnicos:
        include_conectores = True

    query = db.query(Adaptador)
    if include_conectores:
        query = query.options(selectinload(Adaptador.conectores))
        if include_tecnicos:
            query = query.options(
                selectinload(Adaptador.conectores).selectinload(ConectorAdaptador.tecnico_ng),
                selectinload(Adaptador.conectores).selectinload(ConectorAdaptador.tecnico_ultima_validacion)
            )
    
    if modelo:
        query = query.filter(Adaptador.modelo_adaptador.ilike(f"%{modelo}%"))
    if estado:
        query = query.filter(Adaptador.estado == estado)
    
    query = query.order_by(Adaptador.created_at.desc())
    items, total, pages = paginate_query(query, page, page_size)
    
    return PaginatedResponse(
        items=[
            serialize_adaptador(
                adaptador,
                include_conectores=include_conectores,
                include_tecnicos=include_tecnicos
            )
            for adaptador in items
        ],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@router.get("/qr/{codigo_qr}")
async def get_adaptador_by_qr(
    codigo_qr: str,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener adaptador por código QR con conectores"""
    # Usar eager loading para optimizar las consultas y evitar N+1
    adaptador = db.query(Adaptador)\
        .options(selectinload(Adaptador.conectores).selectinload(ConectorAdaptador.tecnico_ng),
                 selectinload(Adaptador.conectores).selectinload(ConectorAdaptador.tecnico_ultima_validacion))\
        .filter(Adaptador.codigo_qr == codigo_qr).first()
    if not adaptador:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptador no encontrado"
        )
    
    # Ya no necesitamos pasar db porque usamos las relaciones directamente
    return serialize_adaptador(adaptador, include_conectores=True, db=None)

@router.get("/modelos", response_model=List[str])
async def get_modelos_disponibles_endpoint(
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener lista de todos los modelos de adaptador disponibles"""
    modelos = get_modelos_disponibles()
    return modelos

@router.get("/{adaptador_id}")
async def get_adaptador(
    adaptador_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener adaptador por ID con conectores y validaciones"""
    adaptador = db.query(Adaptador).filter(Adaptador.id == adaptador_id).first()
    if not adaptador:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptador no encontrado"
        )
    
    result = serialize_adaptador(adaptador, include_conectores=True, db=db)
    
    # Agregar validaciones
    validaciones = db.query(ValidacionAdaptador).filter(
        ValidacionAdaptador.adaptador_id == adaptador_id
    ).order_by(ValidacionAdaptador.fecha.desc()).all()
    
    result["validaciones"] = []
    for validacion in validaciones:
        validacion_dict = {
            "id": validacion.id,
            "fecha": validacion.fecha.isoformat() if validacion.fecha else None,
            "turno": validacion.turno,
            "estado_general": validacion.estado_general,
            "comentario": validacion.comentario,
            "created_at": validacion.created_at.isoformat() if validacion.created_at else None,
        }
        
        if validacion.tecnico:
            validacion_dict["tecnico"] = {
                "id": validacion.tecnico.id,
                "nombre": validacion.tecnico.nombre,
                "numero_empleado": validacion.tecnico.numero_empleado
            }
        
        # Agregar detalle de conectores
        validacion_dict["detalle_conectores"] = []
        for detalle in validacion.detalle_conectores:
            detalle_dict = {
                "id": detalle.id,
                "conector_id": detalle.conector_id,
                "estado": detalle.estado,
                "comentario": detalle.comentario,
            }
            if detalle.conector:
                detalle_dict["conector"] = {
                    "id": detalle.conector.id,
                    "nombre_conector": detalle.conector.nombre_conector
                }
            validacion_dict["detalle_conectores"].append(detalle_dict)
        
        result["validaciones"].append(validacion_dict)
    
    return result

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_adaptador(
    adaptador_data: AdaptadorCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Crear nuevo adaptador con sus conectores"""
    # Verificar si el código QR ya existe
    existing = db.query(Adaptador).filter(Adaptador.codigo_qr == adaptador_data.codigo_qr).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código QR ya existe"
        )
    
    # Crear adaptador
    adaptador = Adaptador(
        codigo_qr=adaptador_data.codigo_qr,
        numero_adaptador=adaptador_data.numero_adaptador,
        modelo_adaptador=adaptador_data.modelo_adaptador,
        estado="activo"
    )
    db.add(adaptador)
    db.flush()  # Para obtener el ID
    
    # Obtener conectores del modelo (o usar los proporcionados)
    nombres_conectores = adaptador_data.conectores
    if not nombres_conectores:
        nombres_conectores = get_conectores_by_modelo(adaptador_data.modelo_adaptador)
    
    if not nombres_conectores:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se encontraron conectores para el modelo {adaptador_data.modelo_adaptador}. Por favor, especifica los conectores manualmente."
        )
    
    # Crear conectores iniciales
    for nombre_conector in nombres_conectores:
        conector = ConectorAdaptador(
            adaptador_id=adaptador.id,
            nombre_conector=nombre_conector,
            estado="PENDIENTE"
        )
        db.add(conector)
    
    db.commit()
    db.refresh(adaptador)
    
    # Para adaptadores recién creados, no necesitamos consultar técnicos
    # ya que los conectores son nuevos y no tienen técnicos asociados
    return serialize_adaptador(adaptador, include_conectores=True, db=None)

@router.put("/{adaptador_id}")
async def update_adaptador(
    adaptador_id: int,
    adaptador_data: AdaptadorUpdate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Actualizar adaptador"""
    adaptador = db.query(Adaptador).filter(Adaptador.id == adaptador_id).first()
    if not adaptador:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptador no encontrado"
        )
    
    if adaptador_data.numero_adaptador:
        adaptador.numero_adaptador = adaptador_data.numero_adaptador
    if adaptador_data.modelo_adaptador:
        adaptador.modelo_adaptador = adaptador_data.modelo_adaptador
    if adaptador_data.estado:
        adaptador.estado = adaptador_data.estado
    
    db.commit()
    db.refresh(adaptador)

    return serialize_adaptador(adaptador, include_conectores=True, db=db)


@router.put("/{adaptador_id}/dual-conector")
async def toggle_dual_conector(
    adaptador_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Toggle es_dual_conector (51+41 pines) para VByOne"""
    adaptador = db.query(Adaptador).filter(Adaptador.id == adaptador_id).first()
    if not adaptador:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptador no encontrado"
        )

    # Toggle el valor
    adaptador.es_dual_conector = not (adaptador.es_dual_conector or False)
    db.commit()
    db.refresh(adaptador)

    return serialize_adaptador(adaptador, include_conectores=True, db=db)


@router.post("/{adaptador_id}/validacion", status_code=status.HTTP_201_CREATED)
async def create_validacion_adaptador(
    adaptador_id: int,
    validacion_data: ValidacionAdaptadorCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Crear validación de adaptador (validar todos los conectores)"""
    adaptador = db.query(Adaptador).filter(Adaptador.id == adaptador_id).first()
    if not adaptador:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptador no encontrado"
        )
    
    # Verificar que todos los conectores del adaptador estén en la validación
    conectores_adaptador = {c.id: c for c in adaptador.conectores}
    conectores_validados = {vc.conector_id for vc in validacion_data.conectores}
    
    if set(conectores_adaptador.keys()) != conectores_validados:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes validar todos los conectores del adaptador"
        )
    
    # Crear validación
    validacion = ValidacionAdaptador(
        adaptador_id=adaptador_id,
        tecnico_id=current_user.id,
        fecha=datetime.utcnow(),
        turno=validacion_data.turno,
        estado_general=validacion_data.estado_general,
        comentario=validacion_data.comentario
    )
    db.add(validacion)
    db.flush()
    
    # Crear detalles de validación por conector y actualizar estado de conectores
    for vc_data in validacion_data.conectores:
        conector = conectores_adaptador[vc_data.conector_id]
        
        # Crear detalle de validación
        detalle = ValidacionConector(
            validacion_adaptador_id=validacion.id,
            conector_id=vc_data.conector_id,
            estado=vc_data.estado,
            comentario=vc_data.comentario
        )
        db.add(detalle)
        
        # Actualizar estado del conector
        conector.fecha_ultima_validacion = datetime.utcnow()
        conector.tecnico_ultima_validacion_id = current_user.id
        
        if vc_data.estado == "NG":
            # Si se marca como NG, actualizar información de NG
            conector.estado = "NG"
            conector.fecha_estado_ng = datetime.utcnow()
            conector.tecnico_ng_id = current_user.id
            conector.usuario_reporte_ng = current_user.nombre
            conector.comentario_ng = vc_data.comentario
        elif vc_data.estado == "OK" and conector.estado == "NG":
            # Si estaba NG y ahora está OK, limpiar información de NG
            conector.estado = "OK"
            conector.fecha_estado_ng = None
            conector.tecnico_ng_id = None
            conector.usuario_reporte_ng = None
            conector.comentario_ng = None
    
    db.commit()
    db.refresh(validacion)
    
    # Serializar respuesta
    result = {
        "id": validacion.id,
        "adaptador_id": validacion.adaptador_id,
        "tecnico_id": validacion.tecnico_id,
        "fecha": validacion.fecha.isoformat(),
        "turno": validacion.turno,
        "estado_general": validacion.estado_general,
        "comentario": validacion.comentario,
        "created_at": validacion.created_at.isoformat(),
        "tecnico": {
            "id": current_user.id,
            "nombre": current_user.nombre,
            "numero_empleado": current_user.numero_empleado
        }
    }
    
    return result

@router.get("/stats/conectores")
async def get_conectores_stats(
    modelo_adaptador: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener estadísticas de inventario de conectores"""
    # Base query para adaptadores activos
    query_adaptadores = db.query(Adaptador).filter(Adaptador.estado == "activo")
    
    if modelo_adaptador:
        query_adaptadores = query_adaptadores.filter(
            Adaptador.modelo_adaptador == modelo_adaptador
        )
    
    total_adaptadores = query_adaptadores.count()
    
    # Obtener estadísticas por conector
    query_conectores = db.query(
        ConectorAdaptador.nombre_conector,
        ConectorAdaptador.estado,
        func.count(ConectorAdaptador.id).label('count')
    ).join(
        Adaptador
    ).filter(
        Adaptador.estado == "activo"
    )
    
    if modelo_adaptador:
        query_conectores = query_conectores.filter(
            Adaptador.modelo_adaptador == modelo_adaptador
        )
    
    stats = query_conectores.group_by(
        ConectorAdaptador.nombre_conector,
        ConectorAdaptador.estado
    ).all()
    
    # Organizar datos por conector
    conectores_dict = {}
    total_ok = 0
    total_ng = 0
    
    for nombre, estado, count in stats:
        if nombre not in conectores_dict:
            conectores_dict[nombre] = {"OK": 0, "NG": 0}
        
        conectores_dict[nombre][estado] = count
        
        if estado == "OK":
            total_ok += count
        else:
            total_ng += count
    
    # Formatear respuesta
    conectores_list = []
    for nombre, estados in conectores_dict.items():
        ok_count = estados.get("OK", 0)
        ng_count = estados.get("NG", 0)
        total_conector = ok_count + ng_count
        disponibilidad = (ok_count / total_conector * 100) if total_conector > 0 else 0
        
        conectores_list.append({
            "nombre": nombre,
            "ok": ok_count,
            "ng": ng_count,
            "total": total_conector,
            "disponibilidad": round(disponibilidad, 2)
        })
    
    # Ordenar por nombre
    conectores_list.sort(key=lambda x: x["nombre"])
    
    return {
        "total_adaptadores": total_adaptadores,
        "total_conectores_ok": total_ok,
        "total_conectores_ng": total_ng,
        "conectores": conectores_list
    }

@router.delete("/{adaptador_id}")
async def delete_adaptador(
    adaptador_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Eliminar adaptador (dar de baja)"""
    adaptador = db.query(Adaptador).filter(Adaptador.id == adaptador_id).first()
    if not adaptador:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptador no encontrado"
        )
    
    # Cambiar estado a baja en lugar de eliminar
    adaptador.estado = "baja"
    db.commit()
    
    return {"message": "Adaptador dado de baja correctamente"}

@router.get("/conectores/{nombre_conector}/modelos")
async def get_modelos_by_conector_name(
    nombre_conector: str,
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener lista de modelos de adaptadores que tienen un conector específico"""
    modelos = get_modelos_by_conector(nombre_conector)
    return {
        "nombre_conector": nombre_conector,
        "modelos": modelos
    }

@router.put("/conectores/{conector_id}/estado")
async def update_conector_estado(
    conector_id: int,
    conector_data: ConectorAdaptadorUpdate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Actualizar estado individual de un conector (OK/NG) y su conector relacionado (solo para adaptadores)"""
    conector = db.query(ConectorAdaptador).filter(ConectorAdaptador.id == conector_id).first()
    if not conector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conector no encontrado"
        )
    
    # Obtener el adaptador para verificar si es adaptador o convertidor
    adaptador = db.query(Adaptador).filter(Adaptador.id == conector.adaptador_id).first()
    if not adaptador:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adaptador no encontrado"
        )
    
    # Determinar si es un adaptador (ADA20100_01/02 o CSTH-100/ZH-S20) o un convertidor
    es_adaptador = adaptador.modelo_adaptador in ["ADA20100_01", "ADA20100_02", "CSTH-100/ZH-S20"]
    
    # Validar estado
    if conector_data.estado not in ["OK", "NG"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El estado debe ser OK o NG"
        )
    
    # Mapeo de conectores relacionados: HD-2 comparte con HD-4, HD-1 comparte con HD-3
    # SOLO aplica para adaptadores
    conector_relations = {
        "ZH-MINI-HD-2": "ZH-MINI-HD-4",
        "ZH-MINI-HD-4": "ZH-MINI-HD-2",
        "ZH-MINI-HD-1": "ZH-MINI-HD-3",
        "ZH-MINI-HD-3": "ZH-MINI-HD-1"
    }
    
    # Encontrar el conector relacionado si existe Y es un adaptador
    conector_relacionado = None
    if es_adaptador:
        nombre_relacionado = conector_relations.get(conector.nombre_conector)
        if nombre_relacionado:
            # Buscar el conector relacionado en el mismo adaptador
            conector_relacionado = db.query(ConectorAdaptador).filter(
                ConectorAdaptador.adaptador_id == conector.adaptador_id,
                ConectorAdaptador.nombre_conector == nombre_relacionado
            ).first()
    
    # Guardar estado anterior
    estado_anterior = conector.estado
    
    # Función helper para actualizar un conector
    def actualizar_conector(conn, estado_previo, es_principal=True):
        # Usar hora local naive (sin zona horaria) para consistencia
        now_local = datetime.now()

        conn.estado = conector_data.estado
        conn.fecha_ultima_validacion = now_local
        conn.tecnico_ultima_validacion_id = current_user.id

        if conector_data.estado == "NG":
            # Si se marca como NG, guardar información de NG
            conn.fecha_estado_ng = now_local
            conn.tecnico_ng_id = current_user.id
            conn.usuario_reporte_ng = current_user.nombre
            # Solo guardar comentario en el conector principal
            if es_principal:
                conn.comentario_ng = conector_data.comentario
        elif conector_data.estado == "OK":
            # Si está OK, limpiar información de NG si existía
            if estado_previo == "NG":
                conn.fecha_estado_ng = None
                conn.tecnico_ng_id = None
                conn.usuario_reporte_ng = None
                conn.comentario_ng = None
    
    # Actualizar el conector principal
    actualizar_conector(conector, estado_anterior, es_principal=True)
    
    # Actualizar el conector relacionado si existe (solo para adaptadores)
    if conector_relacionado:
        estado_anterior_relacionado = conector_relacionado.estado
        actualizar_conector(conector_relacionado, estado_anterior_relacionado, es_principal=False)
    
    db.commit()
    db.refresh(conector)
    if conector_relacionado:
        db.refresh(conector_relacionado)
    
    # Serializar respuesta
    result = {
        "id": conector.id,
        "nombre_conector": conector.nombre_conector,
        "estado": conector.estado,
        "fecha_estado_ng": conector.fecha_estado_ng.isoformat() if conector.fecha_estado_ng else None,
        "comentario_ng": conector.comentario_ng,
        "fecha_ultima_validacion": conector.fecha_ultima_validacion.isoformat() if conector.fecha_ultima_validacion else None,
        "linea_ultima_validacion": conector.linea_ultima_validacion,
        "turno_ultima_validacion": conector.turno_ultima_validacion,
    }
    
    if conector.tecnico_ng_id:
        tecnico_ng = db.query(Tecnico).filter(Tecnico.id == conector.tecnico_ng_id).first()
        if tecnico_ng:
            result["tecnico_ng"] = {
                "id": tecnico_ng.id,
                "nombre": tecnico_ng.nombre,
                "numero_empleado": tecnico_ng.numero_empleado,
                "usuario": tecnico_ng.usuario
            }
    
    if conector.tecnico_ultima_validacion_id:
        tecnico_ultima_validacion = db.query(Tecnico).filter(Tecnico.id == conector.tecnico_ultima_validacion_id).first()
        if tecnico_ultima_validacion:
            result["tecnico_ultima_validacion"] = {
                "id": tecnico_ultima_validacion.id,
                "nombre": tecnico_ultima_validacion.nombre,
                "numero_empleado": tecnico_ultima_validacion.numero_empleado,
                "usuario": tecnico_ultima_validacion.usuario
            }
    
    if conector.usuario_reporte_ng:
        result["usuario_reporte_ng"] = conector.usuario_reporte_ng
    
    return result

@router.put("/conectores/uso-ultimo")
async def bulk_update_conectores_uso(
    payload: ConectorUsoBulkUpdate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Actualizar uso/OK de múltiples conectores (fecha, línea y turno)."""
    if not payload.conector_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se proporcionaron conectores para actualizar."
        )

    # Convertir la fecha a naive (sin zona horaria) para preservar la hora local
    fecha_ok_raw = payload.fecha_ok or datetime.utcnow()
    if fecha_ok_raw.tzinfo is not None:
        # Si tiene zona horaria, usar directamente los componentes de fecha/hora
        fecha_ok = datetime(
            fecha_ok_raw.year,
            fecha_ok_raw.month,
            fecha_ok_raw.day,
            fecha_ok_raw.hour,
            fecha_ok_raw.minute,
            fecha_ok_raw.second,
            fecha_ok_raw.microsecond
        )
    else:
        fecha_ok = fecha_ok_raw

    updated = []

    conectores = db.query(ConectorAdaptador).filter(
        ConectorAdaptador.id.in_(payload.conector_ids)
    ).all()

    if not conectores:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontraron conectores para actualizar."
        )

    for conector in conectores:
        estado_anterior = conector.estado
        conector.estado = "OK"
        conector.fecha_ultima_validacion = fecha_ok
        conector.tecnico_ultima_validacion_id = current_user.id

        if payload.linea is not None:
            conector.linea_ultima_validacion = payload.linea
        if payload.turno is not None:
            conector.turno_ultima_validacion = payload.turno

        if estado_anterior == "NG":
            conector.fecha_estado_ng = None
            conector.tecnico_ng_id = None
            conector.usuario_reporte_ng = None
            conector.comentario_ng = None

        updated.append({
            "id": conector.id,
            "estado": conector.estado,
            "fecha_ultima_validacion": conector.fecha_ultima_validacion.isoformat() if conector.fecha_ultima_validacion else None,
            "linea_ultima_validacion": conector.linea_ultima_validacion,
            "turno_ultima_validacion": conector.turno_ultima_validacion
        })

    db.commit()
    return {
        "updated": updated,
        "total": len(updated)
    }

@router.get("/conectores/{nombre_conector}/modelos-mainboard")
async def get_modelos_mainboard_by_conector(
    nombre_conector: str,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener lista de modelos de mainboard compatibles con un conector"""
    modelos = db.query(ModeloMainboardConector).filter(
        ModeloMainboardConector.nombre_conector == nombre_conector
    ).order_by(ModeloMainboardConector.modelo_mainboard).all()
    
    # Agrupar por modelo mainboard y obtener información adicional
    modelos_dict = {}
    for modelo in modelos:
        modelo_mainboard = modelo.modelo_mainboard
        if modelo_mainboard not in modelos_dict:
            modelos_dict[modelo_mainboard] = {
                "modelo_mainboard": modelo_mainboard,
                "modelos_internos": [],
                "tool_sw": []
            }
        
        # Separar modelos_internos si están en un string separado por comas
        if modelo.modelo_interno:
            modelos_internos = [m.strip() for m in str(modelo.modelo_interno).split(',') if m.strip()]
            for modelo_interno in modelos_internos:
                if modelo_interno not in modelos_dict[modelo_mainboard]["modelos_internos"]:
                    modelos_dict[modelo_mainboard]["modelos_internos"].append(modelo_interno)
        
        # Separar tool_sw si están en un string separado por comas
        if modelo.tool_sw:
            tools_sw = [t.strip() for t in str(modelo.tool_sw).split(',') if t.strip()]
            for tool_sw in tools_sw:
                if tool_sw not in modelos_dict[modelo_mainboard]["tool_sw"]:
                    modelos_dict[modelo_mainboard]["tool_sw"].append(tool_sw)
    
    # Convertir a lista
    modelos_list = list(modelos_dict.values())
    
    return {
        "nombre_conector": nombre_conector,
        "modelos_mainboard": modelos_list,
        "total": len(modelos_list)
    }

@router.get("/mainboard/search")
async def search_mainboard_models(
    query: str = Query(..., min_length=1, description="Texto para buscar modelos de mainboard"),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Buscar modelos de mainboard por nombre (para autocompletado)"""
    modelos = db.query(ModeloMainboardConector.modelo_mainboard).filter(
        ModeloMainboardConector.modelo_mainboard.ilike(f"%{query}%")
    ).distinct().order_by(ModeloMainboardConector.modelo_mainboard).limit(20).all()
    
    return {
        "suggestions": [modelo[0] for modelo in modelos]
    }

@router.get("/mainboard/detalles")
async def get_mainboard_details(
    modelo_mainboard: str = Query(..., description="Modelo de mainboard a buscar"),
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener detalles completos de un modelo de mainboard: adaptadores, conectores, modelos internos, tool_sw"""
    # FastAPI ya decodifica automáticamente los parámetros de ruta
    logger.info(f"🔍 Buscando modelo mainboard: [{repr(modelo_mainboard)}] (longitud: {len(modelo_mainboard)})")
    
    # Obtener todos los registros de este modelo mainboard
    modelos = db.query(ModeloMainboardConector).filter(
        ModeloMainboardConector.modelo_mainboard == modelo_mainboard
    ).all()
    
    if not modelos:
        # Intentar búsqueda sin espacios al inicio/final por si hay problemas de encoding
        modelo_trimmed = modelo_mainboard.strip()
        if modelo_trimmed != modelo_mainboard:
            logger.info(f"🔍 Intentando búsqueda sin espacios: [{repr(modelo_trimmed)}]")
            modelos = db.query(ModeloMainboardConector).filter(
                ModeloMainboardConector.modelo_mainboard == modelo_trimmed
            ).all()
        
        if not modelos:
            logger.error(f"❌ Modelo mainboard no encontrado: [{repr(modelo_mainboard)}]")
            # Buscar modelos similares para debugging
            modelos_similares = db.query(ModeloMainboardConector.modelo_mainboard).filter(
                ModeloMainboardConector.modelo_mainboard.like(f"%{modelo_mainboard[:10]}%")
            ).distinct().limit(5).all()
            logger.info(f"🔍 Modelos similares encontrados: {[m[0] for m in modelos_similares]}")
            raise HTTPException(status_code=404, detail=f"Modelo mainboard {modelo_mainboard} no encontrado")
    
    # Agrupar por conector
    conectores_dict = {}
    for modelo in modelos:
        nombre_conector = modelo.nombre_conector
        if nombre_conector not in conectores_dict:
            conectores_dict[nombre_conector] = {
                "nombre_conector": nombre_conector,
                "modelos_internos": set(),
                "tool_sw": set(),
                "modelos_adaptador": []
            }
        
        # Agregar modelos internos
        if modelo.modelo_interno:
            modelos_internos = [m.strip() for m in str(modelo.modelo_interno).split(',') if m.strip()]
            conectores_dict[nombre_conector]["modelos_internos"].update(modelos_internos)
        
        # Agregar tool_sw
        if modelo.tool_sw:
            tools_sw = [t.strip() for t in str(modelo.tool_sw).split(',') if t.strip() and t.strip() != '/']
            conectores_dict[nombre_conector]["tool_sw"].update(tools_sw)
    
    # Para cada conector, obtener qué modelos de adaptador lo usan
    for nombre_conector in conectores_dict:
        modelos_adaptador = get_modelos_by_conector(nombre_conector)
        conectores_dict[nombre_conector]["modelos_adaptador"] = modelos_adaptador
    
    # Convertir sets a listas ordenadas
    resultado = {
        "modelo_mainboard": modelo_mainboard,
        "conectores": []
    }
    
    for nombre_conector, datos in conectores_dict.items():
        resultado["conectores"].append({
            "nombre_conector": nombre_conector,
            "modelos_adaptador": sorted(datos["modelos_adaptador"]),
            "modelos_internos": sorted(list(datos["modelos_internos"])),
            "tool_sw": sorted(list(datos["tool_sw"]))
        })
    
    # Ordenar conectores por nombre
    resultado["conectores"].sort(key=lambda x: x["nombre_conector"])
    
    return resultado

