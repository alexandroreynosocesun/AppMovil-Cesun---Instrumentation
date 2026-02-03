from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime, timezone
import os
from ..database import get_db
from ..models.models import Validacion, Reparacion, Jig, JigNG, AuditoriaPDF
from ..schemas import Validacion as ValidacionSchema, ValidacionCreate, ReparacionCreate, PaginatedResponse
from ..auth import get_current_user
from ..models.models import Tecnico
from ..services.pdf_service import generate_validation_pdf, generate_turn_report_pdf, generate_validation_report_pdf, generate_batch_validation_report_pdf
from ..utils.logger import api_logger, db_logger
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.post("/", response_model=ValidacionSchema)
async def create_validation(
    validation_data: ValidacionCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Crear nueva validación"""
    # Si viene jig_id, verificar que el jig existe
    # Convertir jig_id = 0 a None (para asignaciones sin jig específico)
    jig_id = validation_data.jig_id if validation_data.jig_id and validation_data.jig_id > 0 else None
    
    jig = None
    if jig_id:
        jig = db.query(Jig).filter(Jig.id == jig_id).first()
        if not jig:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Jig no encontrado"
            )
    
    # Verificar si el jig está marcado como NG (solo si hay jig_id)
    jig_ng_activo = None
    if jig_id:
        jig_ng_activo = db.query(JigNG).filter(
            JigNG.jig_id == jig_id,
            JigNG.estado.in_(["pendiente", "en_reparacion"])
        ).first()
    
    if jig_ng_activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "JIG_NG_DETECTADO",
                "mensaje": f"Este jig está marcado como NG y requiere reparación antes de validar",
                "jig_ng": {
                    "id": jig_ng_activo.id,
                    "motivo": jig_ng_activo.motivo,
                    "categoria": jig_ng_activo.categoria,
                    "prioridad": jig_ng_activo.prioridad,
                    "fecha_ng": jig_ng_activo.fecha_ng,
                    "estado": jig_ng_activo.estado
                }
            }
        )
    
    # Crear validación
    # Si viene tecnico_asignado_id en los datos, usarlo (para asignaciones)
    validation_dict = validation_data.dict()
    # Asegurar que jig_id sea None si es 0 o None (para asignaciones sin jig específico)
    validation_dict['jig_id'] = jig_id
    tecnico_asignado_id = validation_dict.pop('tecnico_asignado_id', None)
    modelo_actual = validation_dict.pop('modelo_actual', None)
    fecha_cliente = validation_dict.pop('fecha', None)  # Fecha ISO string del cliente
    
    # Si se proporciona un modelo y hay un jig, actualizar el jig
    if modelo_actual and jig:
        jig.modelo_actual = modelo_actual

    # Actualizar campos de última validación en el jig
    turno_actual = validation_data.turno
    if jig:
        # Usar datetime.now() para obtener la hora local naive
        jig.fecha_ultima_validacion = datetime.now()
        jig.tecnico_ultima_validacion_id = current_user.id
        jig.turno_ultima_validacion = turno_actual

        # Invalidar caché del jig
        from ..services.cache_service import cache_service
        cache_key = f"jig:qr:{jig.codigo_qr}"
        cache_service.delete(cache_key)

    # Procesar fecha: si viene del cliente (ISO string), parsearla; si no, usar utcnow()
    if fecha_cliente:
        try:
            # Parsear fecha ISO string del cliente (viene como "2024-01-09T16:00:00.000Z")
            # Convertir a datetime naive en UTC (SQLAlchemy espera naive datetime)
            if isinstance(fecha_cliente, str):
                # Manejar formato ISO con 'Z' (UTC)
                if fecha_cliente.endswith('Z'):
                    fecha_str = fecha_cliente[:-1] + '+00:00'
                elif '+' in fecha_cliente or fecha_cliente.count('-') > 2:
                    # Ya tiene timezone
                    fecha_str = fecha_cliente
                else:
                    # No tiene timezone, asumir UTC
                    fecha_str = fecha_cliente + '+00:00'
                
                # Parsear y convertir a naive datetime (asumiendo UTC)
                fecha_con_tz = datetime.fromisoformat(fecha_str.replace('Z', '+00:00'))
                # Convertir a UTC y luego quitar timezone para SQLAlchemy
                if fecha_con_tz.tzinfo:
                    fecha_utc = fecha_con_tz.astimezone(timezone.utc).replace(tzinfo=None)
                else:
                    fecha_utc = fecha_con_tz
            else:
                fecha_utc = datetime.utcnow()
        except Exception as e:
            print(f"Error parseando fecha del cliente: {e}, usando utcnow()")
            fecha_utc = datetime.utcnow()
    else:
        # Si no viene fecha del cliente, usar hora actual del servidor en UTC
        fecha_utc = datetime.utcnow()
    
    db_validation = Validacion(
        **validation_dict,
        tecnico_id=current_user.id,
        tecnico_asignado_id=tecnico_asignado_id,
        fecha=fecha_utc
    )
    
    db.add(db_validation)
    db.commit()
    db.refresh(db_validation)
    
    # Si el estado es NG y hay jig_id, crear reparación automáticamente
    if validation_data.estado == "NG" and jig_id:
        reparacion = Reparacion(
            jig_id=validation_data.jig_id,
            tecnico_id=current_user.id,
            descripcion=f"Reparación requerida: {validation_data.comentario or 'Sin comentarios'}",
            estado_anterior="activo",
            estado_nuevo="reparacion"
        )
        db.add(reparacion)
        
        # Actualizar estado del jig
        if jig:
            jig.estado = "reparacion"
            db.commit()
    
    # Generar PDF (en background) - solo si hay jig
    if jig:
        try:
            pdf_path = generate_validation_pdf(db_validation, jig, current_user)
            db_validation.sincronizado = True
            db.commit()
        except Exception as e:
            # Log error but don't fail the validation
            print(f"Error generando PDF: {e}")
    
    return ValidacionSchema.model_validate(db_validation)

@router.get("/", response_model=PaginatedResponse[ValidacionSchema])
async def get_validations(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Tamaño de página (máximo 100)"),
    jig_id: int = None,
    turno: str = None,
    tecnico_asignado_id: int = None,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """
    Obtener validaciones con filtros opcionales y paginación
    
    - **page**: Número de página (empezando en 1)
    - **page_size**: Cantidad de elementos por página (máximo 100)
    - **jig_id**: Filtrar por ID de jig (opcional)
    - **turno**: Filtrar por turno A, B, C (opcional)
    - **tecnico_asignado_id**: Filtrar por técnico asignado (opcional)
    
    Los usuarios de gestión no pueden acceder a este endpoint.
    Todos los demás roles pueden ver las validaciones.
    """
    from ..utils.pagination import paginate_query
    
    query = db.query(Validacion).options(joinedload(Validacion.jig))
    
    # Si es gestión, no debe ver validaciones (solo gestiona QRs)
    if current_user.tipo_usuario == "gestion" or current_user.tipo_usuario == "Gestion":
        # Retornar lista vacía para gestión
        query = query.filter(Validacion.id == -1)  # Condición imposible para retornar vacío
    # Si es técnico, puede ver todas las validaciones (para ver estatus)
    elif current_user.tipo_usuario == "tecnico":
        pass  # Ver todas las validaciones
    # Si es asignaciones/ingeniero, puede ver todas
    elif current_user.tipo_usuario == "asignaciones" or current_user.tipo_usuario == "ingeniero":
        pass  # Ver todas
    # Para otros roles, ver todas
    else:
        pass
    
    if jig_id:
        query = query.filter(Validacion.jig_id == jig_id)
    if turno:
        query = query.filter(Validacion.turno == turno)
    if tecnico_asignado_id:
        query = query.filter(Validacion.tecnico_asignado_id == tecnico_asignado_id)
    
    # Ordenar por fecha más reciente primero
    query = query.order_by(Validacion.fecha.desc())
    
    items, total, pages = paginate_query(query, page, page_size)
    
    serialized_items = []
    for v in items:
        data = ValidacionSchema.model_validate(v).model_dump()
        if not data.get("modelo_actual"):
            if v.jig:
                data["modelo_actual"] = v.jig.modelo_actual
            elif v.comentario:
                comentario_lower = v.comentario.lower()
                if "modelo:" in comentario_lower:
                    try:
                        for part in v.comentario.split("|"):
                            if "modelo:" in part.lower():
                                value = part.split(":", 1)[1].strip()
                                if value:
                                    data["modelo_actual"] = value
                                    break
                    except Exception:
                        pass
        serialized_items.append(data)

    return PaginatedResponse(
        items=serialized_items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@router.post("/asignar")
async def asignar_validacion(
    request_data: dict,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Asignar una validación a un técnico por número de empleado (solo asignaciones)"""
    validation_id = request_data.get('validation_id')
    numero_empleado = request_data.get('numero_empleado')
    
    if not validation_id or not numero_empleado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="validation_id y numero_empleado son requeridos"
        )
    
    # Verificar que el usuario es de tipo asignaciones
    if current_user.tipo_usuario != "asignaciones" and current_user.tipo_usuario != "ingeniero":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los usuarios de asignaciones pueden asignar validaciones"
        )
    
    # Buscar la validación
    validacion = db.query(Validacion).filter(Validacion.id == validation_id).first()
    if not validacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Validación no encontrada"
        )
    
    # Buscar el técnico por número de empleado
    tecnico = db.query(Tecnico).filter(Tecnico.numero_empleado == numero_empleado).first()
    if not tecnico:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró un técnico con el número de empleado: {numero_empleado}"
        )
    
    # Verificar que el técnico es de tipo "tecnico"
    if tecnico.tipo_usuario != "tecnico":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden asignar validaciones a técnicos"
        )
    
    # Asignar la validación
    validacion.tecnico_asignado_id = tecnico.id
    db.commit()
    db.refresh(validacion)
    
    return {
        "message": f"Validación asignada correctamente al técnico {tecnico.nombre}",
        "validacion": ValidacionSchema.model_validate(validacion),
        "tecnico_asignado": {
            "id": tecnico.id,
            "nombre": tecnico.nombre,
            "numero_empleado": tecnico.numero_empleado
        }
    }

@router.put("/{validation_id}/completar")
async def marcar_completada(
    validation_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Marcar una validación asignada como completada (solo el técnico asignado)"""
    validacion = db.query(Validacion).filter(Validacion.id == validation_id).first()
    if not validacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Validación no encontrada"
        )
    
    # Verificar que el usuario es el técnico asignado
    if validacion.tecnico_asignado_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el técnico asignado puede marcar esta validación como completada"
        )
    
    validacion.completada = True
    db.commit()
    db.refresh(validacion)
    
    return {
        "message": "Validación marcada como completada",
        "validation": ValidacionSchema.model_validate(validacion)
    }

@router.delete("/{validation_id}")
async def delete_validation(
    validation_id: int,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Eliminar una validación (solo administradores)"""
    # Verificar que el usuario es administrador
    ADMIN_USERS = ["admin", "superadmin"]
    if current_user.usuario not in ADMIN_USERS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Solo administradores pueden eliminar validaciones."
        )
    
    validacion = db.query(Validacion).filter(Validacion.id == validation_id).first()
    if not validacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Validación no encontrada"
        )
    
    # Eliminar la validación
    db.delete(validacion)
    db.commit()
    
    return {
        "message": "Validación eliminada correctamente",
        "validation_id": validation_id
    }

@router.get("/sync-pending")
async def sync_pending_validations(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Sincronizar validaciones pendientes"""
    pending_validations = db.query(Validacion).filter(Validacion.sincronizado == False).all()
    
    synced_count = 0
    for validation in pending_validations:
        try:
            jig = db.query(Jig).filter(Jig.id == validation.jig_id).first()
            pdf_path = generate_validation_pdf(validation, jig, current_user)
            validation.sincronizado = True
            synced_count += 1
        except Exception as e:
            print(f"Error sincronizando validación {validation.id}: {e}")
    
    db.commit()
    
    return {
        "message": f"Se sincronizaron {synced_count} validaciones",
        "total_pending": len(pending_validations)
    }

@router.get("/reports/turno/{turno}")
async def get_turn_report(
    turno: str,
    fecha: str = None,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Generar reporte por turno"""
    from datetime import date
    
    if not fecha:
        fecha = date.today().isoformat()
    
    validations = db.query(Validacion).filter(
        Validacion.turno == turno,
        Validacion.fecha >= fecha
    ).all()
    
    # Generar reporte PDF
    try:
        pdf_path = generate_turn_report_pdf(validations, turno, fecha)
        return {"report_path": pdf_path, "validations_count": len(validations)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando reporte: {str(e)}"
        )

@router.post("/generate-report")
async def generate_validation_report(
    report_data: dict,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Generar reporte de validación individual"""
    try:
        # Generar PDF del reporte
        pdf_path = generate_validation_report_pdf(report_data)
        
        return {
            "success": True,
            "validation_id": None,
            "pdf_path": pdf_path,
            "pdf_filename": os.path.basename(pdf_path)
        }
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando reporte de validación: {str(e)}"
        )

@router.post("/generate-batch-report")
async def generate_batch_validation_report(
    report_data: dict,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Generar reporte de validación por lotes (múltiples jigs del mismo modelo)"""
    try:
        print(f"📊 Generando reporte por lotes - Datos recibidos: {report_data}")
        
        modelo = report_data.get("modelo")
        validations = report_data.get("validaciones", [])  # Corregido: validaciones en lugar de validations
        fecha = report_data.get("fecha")
        turno = report_data.get("turno")
        
        print(f"📋 Modelo: {modelo}, Validaciones: {len(validations)}, Fecha: {fecha}, Turno: {turno}")
        
        if not modelo or not validations:
            print("❌ Error: Modelo o validaciones faltantes")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Modelo y validaciones son requeridos"
            )
        
        # Obtener la línea de la primera validación (todas tienen la misma línea)
        linea = '-'
        if validations and len(validations) > 0:
            primera_validacion = validations[0]
            linea = primera_validacion.get('linea', '-')
            # Normalizar la línea: eliminar espacios y convertir a string
            if linea:
                linea = str(linea).strip()
            else:
                linea = '-'
            print(f"📋 Primera validación completa: {primera_validacion}")
            print(f"📋 Línea obtenida del reporte: '{linea}' (tipo: {type(linea)})")
            # Si la línea está vacía o es None, intentar obtenerla de otra forma
            if not linea or linea == '-' or linea == '':
                print(f"⚠️ Línea vacía o guión, buscando en otras validaciones...")
                for v in validations:
                    v_linea = v.get('linea', '')
                    if v_linea:
                        v_linea = str(v_linea).strip()
                    if v_linea and v_linea != '-' and v_linea != '':
                        linea = v_linea
                        print(f"✅ Línea encontrada en otra validación: '{linea}'")
                        break
        
        # Preparar validaciones para PDF SIN crear registros en BD
        validaciones_para_pdf = []
        print(f"📊 INICIO: Total validaciones recibidas: {len(validations)}")

        for i, validation_data in enumerate(validations):
            print(f"\n{'='*60}")
            print(f"🔍 Procesando validación {i+1}/{len(validations)}")
            print(f"   Datos completos: {validation_data}")
            
            # Usar la fecha del reporte si no hay fecha específica en la validación
            validation_fecha_raw = validation_data.get("fecha") or fecha
            validation_turno = validation_data.get("turno") or turno
            
            # Convertir fecha ISO string a datetime object
            if isinstance(validation_fecha_raw, str):
                if 'T' in validation_fecha_raw:
                    validation_fecha = datetime.fromisoformat(validation_fecha_raw.replace('Z', '+00:00'))
                else:
                    validation_fecha = datetime.fromisoformat(validation_fecha_raw)
            else:
                validation_fecha = validation_fecha_raw
            
            # Validar campos requeridos
            jig_id = validation_data.get("jig_id")
            
            print(f"   jig_id: {jig_id} (tipo: {type(jig_id)})")
            
            if not jig_id:
                print(f"   ❌ ERROR: Campos faltantes - jig_id={jig_id}")
                print(f"   ⏭️ OMITIENDO esta validación")
                continue
            
            # Verificar que el jig existe en la BD
            jig_exists = db.query(Jig).filter(Jig.id == jig_id).first()
            if not jig_exists:
                print(f"   ❌ ERROR: Jig {jig_id} no existe en la BD")
                print(f"   ⏭️ OMITIENDO esta validación")
                continue

            print(f"   ✅ Jig {jig_id} existe: {jig_exists.numero_jig}")

            # Actualizar campos de última validación en el jig
            jig_exists.fecha_ultima_validacion = datetime.now()
            jig_exists.tecnico_ultima_validacion_id = current_user.id
            jig_exists.turno_ultima_validacion = validation_turno
            print(f"   ✅ Actualizando última validación del Jig {jig_exists.numero_jig}")

            # Invalidar caché del jig
            from ..services.cache_service import cache_service
            cache_key = f"jig:qr:{jig_exists.codigo_qr}"
            cache_service.delete(cache_key)
            print(f"   🗑️ Caché invalidado para {jig_exists.codigo_qr}")

            validaciones_para_pdf.append({
                'numero_jig': jig_exists.numero_jig,
                'tipo': jig_exists.tipo,
                'estado': validation_data.get("estado", "OK"),
                'comentario': validation_data.get("comentario", "") or 'Sin comentarios',
                'turno': validation_turno,
                'created_at': validation_fecha.isoformat() if validation_fecha else ''
            })
            print(f"   ✅ Validación {i+1} agregada al PDF - Jig: {jig_exists.numero_jig}")

        # Guardar todos los cambios en la base de datos
        db.commit()
        print(f"✅ Actualizaciones de última validación guardadas en la BD")

        # Generar PDF del reporte por lotes
        print(f"\n📄 Generando PDF del reporte...")
        pdf_path = None
        try:
            api_logger.info(f"Total validaciones para PDF: {len(validaciones_para_pdf)}")
            
            if not validaciones_para_pdf:
                raise ValueError("No hay validaciones válidas para generar el PDF")
            
            # Obtener número de empleado del usuario actual (current_user)
            numero_empleado = current_user.numero_empleado if current_user else 'N/A'
            tecnico_nombre = current_user.nombre if current_user else report_data.get('tecnico', 'N/A')
            
            pdf_data = {
                'fecha': fecha,
                'turno': turno,
                'tecnico': tecnico_nombre,
                'tecnico_id': current_user.id if current_user else report_data.get('tecnico_id', 1),
                'numero_empleado': numero_empleado,
                'modelo': modelo,
                'linea': linea,  # Agregar la línea al pdf_data
                'validaciones': validaciones_para_pdf
            }
            api_logger.info(f"Generando PDF - Técnico: {tecnico_nombre}, No. Empleado: {numero_empleado}, Validaciones: {len(pdf_data['validaciones'])}")
            
            pdf_path = generate_batch_validation_report_pdf(pdf_data)
            api_logger.info(f"PDF generado exitosamente: {pdf_path}")
            
            # Guardar PDF en auditoría
            try:
                api_logger.info(f"💾 Iniciando guardado en auditoría...")
                fecha_obj = datetime.fromisoformat(fecha.replace('Z', '+00:00')) if isinstance(fecha, str) else fecha
                if isinstance(fecha_obj, str):
                    fecha_obj = datetime.fromisoformat(fecha_obj.replace('Z', '+00:00'))
                
                # Convertir a UTC si tiene timezone, o usar directamente si es naive
                if fecha_obj.tzinfo is not None:
                    # Convertir a UTC para evitar problemas de zona horaria
                    fecha_utc = fecha_obj.astimezone(timezone.utc)
                    fecha_date = fecha_utc.date()
                else:
                    # Si no tiene timezone, asumir que ya está en la zona correcta
                    fecha_date = fecha_obj.date()
                
                # Extraer día, mes y año de la fecha (sin hora) para evitar problemas de zona horaria
                fecha_dia = fecha_date.day
                fecha_mes = fecha_date.month
                fecha_anio = fecha_date.year
                
                api_logger.info(f"📅 Fecha procesada: {fecha_obj} -> fecha_date={fecha_date} (día={fecha_dia}, mes={fecha_mes}, año={fecha_anio})")
                
                # Verificar si ya existe un PDF con los mismos datos (modelo, fecha, turno, tecnico, linea)
                tecnico_id = current_user.id if current_user else report_data.get('tecnico_id', 1)
                api_logger.info(f"🔍 Buscando PDF existente: modelo={modelo}, fecha={fecha_date}, turno={turno.upper()}, tecnico_id={tecnico_id}, linea={linea}")
                
                existing_pdf = db.query(AuditoriaPDF).filter(
                    AuditoriaPDF.modelo == modelo,
                    AuditoriaPDF.fecha_dia == fecha_dia,
                    AuditoriaPDF.fecha_mes == fecha_mes,
                    AuditoriaPDF.fecha_anio == fecha_anio,
                    AuditoriaPDF.turno == turno.upper(),
                    AuditoriaPDF.tecnico_id == tecnico_id,
                    AuditoriaPDF.linea == linea
                ).first()
                
                if existing_pdf:
                    api_logger.warning(f"⚠️ PDF duplicado detectado. Ya existe un PDF con ID={existing_pdf.id}, modelo={modelo}, fecha={fecha_date}, turno={turno}, tecnico_id={tecnico_id}, linea={linea}")
                    api_logger.warning(f"   PDF existente: {existing_pdf.nombre_archivo}")
                    # No guardar el duplicado, pero continuar con el proceso
                    # Eliminar el archivo PDF generado para no dejar archivos huérfanos
                    try:
                        if os.path.exists(pdf_path):
                            os.remove(pdf_path)
                            api_logger.info(f"🗑️ Archivo PDF duplicado eliminado: {pdf_path}")
                    except Exception as del_error:
                        api_logger.warning(f"⚠️ Error eliminando PDF duplicado: {del_error}")
                else:
                    api_logger.info(f"✅ No se encontró PDF duplicado. Guardando nuevo PDF en auditoría...")
                    auditoria_pdf = AuditoriaPDF(
                        nombre_archivo=os.path.basename(pdf_path),
                        ruta_archivo=pdf_path,
                        modelo=modelo,
                        tecnico_id=tecnico_id,
                        tecnico_nombre=tecnico_nombre,
                        numero_empleado=numero_empleado,
                        fecha=fecha_obj,
                        fecha_dia=fecha_dia,  # Usar la fecha extraída de fecha_date
                        fecha_mes=fecha_mes,   # Usar la fecha extraída de fecha_date
                        fecha_anio=fecha_anio, # Usar la fecha extraída de fecha_date
                        turno=turno.upper(),
                        linea=str(linea).strip() if linea and str(linea).strip() != '-' else None,  # Normalizar línea al guardar
                        cantidad_validaciones=len(validaciones_para_pdf)
                    )
                    db.add(auditoria_pdf)
                    db.commit()
                    db.refresh(auditoria_pdf)
                    api_logger.info(f"✅ PDF guardado en auditoría exitosamente: ID={auditoria_pdf.id}, modelo={modelo}, linea={linea}, fecha={fecha_date}, turno={turno}, tecnico_id={tecnico_id}, nombre={auditoria_pdf.nombre_archivo}")
            except Exception as audit_error:
                error_str = str(audit_error)
                # Si es un error de llave duplicada en auditoria_pdfs, corregir la secuencia y reintentar
                if "UniqueViolation" in error_str and "auditoria_pdfs_pkey" in error_str:
                    api_logger.warning(f"⚠️ Error de llave duplicada en auditoría detectado. Corrigiendo secuencia...")
                    try:
                        from sqlalchemy import text
                        # Obtener el máximo ID actual
                        max_id_result = db.execute(text("SELECT COALESCE(MAX(id), 0) FROM auditoria_pdfs"))
                        max_id = max_id_result.scalar()
                        # Actualizar la secuencia al siguiente valor disponible
                        db.execute(text(f"SELECT setval('auditoria_pdfs_id_seq', {max_id}, true)"))
                        db.commit()
                        api_logger.info(f"✅ Secuencia de auditoría corregida. Reintentando guardar PDF...")
                        
                        # Reintentar el guardado (usar las mismas variables fecha_dia, fecha_mes, fecha_anio calculadas arriba)
                        auditoria_pdf = AuditoriaPDF(
                            nombre_archivo=os.path.basename(pdf_path),
                            ruta_archivo=pdf_path,
                            modelo=modelo,
                            tecnico_id=tecnico_id,
                            tecnico_nombre=tecnico_nombre,
                            numero_empleado=numero_empleado,
                            fecha=fecha_obj,
                            fecha_dia=fecha_dia,  # Usar la fecha extraída de fecha_date
                            fecha_mes=fecha_mes,   # Usar la fecha extraída de fecha_date
                            fecha_anio=fecha_anio, # Usar la fecha extraída de fecha_date
                            turno=turno.upper(),
                            linea=str(linea).strip() if linea and str(linea).strip() != '-' else None,  # Normalizar línea al guardar
                            cantidad_validaciones=len(validaciones_para_pdf)
                        )
                        db.add(auditoria_pdf)
                        db.commit()
                        db.refresh(auditoria_pdf)
                        api_logger.info(f"✅ PDF guardado en auditoría exitosamente después de corregir secuencia: ID={auditoria_pdf.id}, modelo={modelo}, linea={linea}, fecha={fecha_date}, turno={turno}, tecnico_id={tecnico_id}, nombre={auditoria_pdf.nombre_archivo}")
                    except Exception as retry_error:
                        api_logger.error(f"❌ Error al reintentar después de corregir secuencia de auditoría: {retry_error}", exc_info=True)
                        # No fallar si no se puede guardar en auditoría, pero loguear el error
                else:
                    api_logger.error(f"❌ Error guardando en auditoría: {audit_error}", exc_info=True)
                    import traceback
                    api_logger.error(f"❌ Traceback completo: {traceback.format_exc()}")
                    # No fallar si no se puede guardar en auditoría, pero loguear el error
        except Exception as pdf_error:
            api_logger.error(f"Error generando PDF: {pdf_error}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error generando PDF: {str(pdf_error)}"
            )
        
        if not pdf_path:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error: No se pudo generar el PDF (ruta no disponible)"
            )
        
        return {
            "success": True,
            "modelo": modelo,
            "validations_count": len(validaciones_para_pdf),
            "pdf_filename": os.path.basename(pdf_path),
            "pdf_path": pdf_path
        }
            
    except HTTPException:
        # Re-lanzar HTTPExceptions sin modificar
        raise
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        error_message = str(e) if str(e) else type(e).__name__
        api_logger.error(f"Error generando reporte por lotes: {error_message}", exc_info=True)
        api_logger.error(f"Traceback completo: {error_traceback}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando reporte por lotes: {error_message}"
        )

@router.get("/download-pdf/{filename}")
async def download_pdf(filename: str):
    """Descargar archivo PDF generado"""
    try:
        # Construir la ruta del archivo
        file_path = os.path.join("reports", filename)
        
        # Verificar que el archivo existe
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Archivo PDF no encontrado"
            )
        
        # Retornar el archivo para descarga
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='application/pdf'
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error descargando PDF: {str(e)}"
        )
