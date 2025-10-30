from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import os
from ..database import get_db
from ..models.models import Validacion, Reparacion, Jig, JigNG
from ..schemas import Validacion as ValidacionSchema, ValidacionCreate, ReparacionCreate
from ..auth import get_current_user
from ..models.models import Tecnico
from ..services.pdf_service import generate_validation_pdf, generate_turn_report_pdf, generate_validation_report_pdf, generate_batch_validation_report_pdf
from ..services.asana_service import upload_to_asana

router = APIRouter()

@router.post("/", response_model=ValidacionSchema)
async def create_validation(
    validation_data: ValidacionCreate,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Crear nueva validación"""
    # Verificar que el jig existe
    jig = db.query(Jig).filter(Jig.id == validation_data.jig_id).first()
    if not jig:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jig no encontrado"
        )
    
    # Verificar si el jig está marcado como NG
    jig_ng_activo = db.query(JigNG).filter(
        JigNG.jig_id == validation_data.jig_id,
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
    db_validation = Validacion(
        **validation_data.dict(),
        tecnico_id=current_user.id,
        fecha=datetime.utcnow()
    )
    
    db.add(db_validation)
    db.commit()
    db.refresh(db_validation)
    
    # Si el estado es NG, crear reparación automáticamente
    if validation_data.estado == "NG":
        reparacion = Reparacion(
            jig_id=validation_data.jig_id,
            tecnico_id=current_user.id,
            descripcion=f"Reparación requerida: {validation_data.comentario or 'Sin comentarios'}",
            estado_anterior="activo",
            estado_nuevo="reparacion"
        )
        db.add(reparacion)
        
        # Actualizar estado del jig
        jig.estado = "reparacion"
        db.commit()
    
    # Generar PDF y subir a Asana (en background)
    try:
        pdf_path = generate_validation_pdf(db_validation, jig, current_user)
        upload_to_asana(pdf_path, jig.numero_jig, validation_data.fecha)
        db_validation.sincronizado = True
        db.commit()
    except Exception as e:
        # Log error but don't fail the validation
        print(f"Error generando PDF o subiendo a Asana: {e}")
    
    return ValidacionSchema.model_validate(db_validation)

@router.get("/", response_model=List[ValidacionSchema])
async def get_validations(
    skip: int = 0,
    limit: int = 100,
    jig_id: int = None,
    turno: str = None,
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtener validaciones con filtros opcionales"""
    query = db.query(Validacion)
    
    if jig_id:
        query = query.filter(Validacion.jig_id == jig_id)
    if turno:
        query = query.filter(Validacion.turno == turno)
    
    validations = query.offset(skip).limit(limit).all()
    return validations

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
            upload_to_asana(pdf_path, jig.numero_jig, validation.fecha)
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
        # Crear la validación en la base de datos
        validation = Validacion(
            jig_id=report_data.get("jig_id"),
            tecnico_id=report_data.get("tecnico_id"),
            fecha=report_data.get("fecha"),
            turno=report_data.get("turno"),
            estado="OK",  # Por defecto OK para reportes
            comentario=report_data.get("comentario", ""),
            cantidad=report_data.get("cantidad", 1)
        )
        
        db.add(validation)
        db.commit()
        db.refresh(validation)
        
        # Generar PDF del reporte
        pdf_path = generate_validation_report_pdf(report_data)
        
        # Subir a Asana (opcional)
        try:
            asana_url = await upload_to_asana(pdf_path, f"Validación Jig {report_data.get('numero_jig')}")
            return {
                "success": True,
                "validation_id": validation.id,
                "pdf_path": pdf_path,
                "asana_url": asana_url
            }
        except Exception as e:
            return {
                "success": True,
                "validation_id": validation.id,
                "pdf_path": pdf_path,
                "asana_error": str(e)
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
        
        # Crear validaciones en la base de datos
        created_validations = []
        for i, validation_data in enumerate(validations):
            print(f"🔍 Procesando validación {i+1}: {validation_data}")
            
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
            tecnico_id = validation_data.get("tecnico_id") or report_data.get("tecnico_id")
            
            print(f"🔍 Validación {i+1} - jig_id: {jig_id}, tecnico_id: {tecnico_id}")
            
            if not jig_id or not tecnico_id:
                print(f"❌ Error en validación {i+1}: jig_id={jig_id}, tecnico_id={tecnico_id}")
                continue
            
            # Verificar que el jig existe en la BD
            jig_exists = db.query(Jig).filter(Jig.id == jig_id).first()
            if not jig_exists:
                print(f"❌ Jig {jig_id} no existe en la BD")
                continue
            print(f"✅ Jig {jig_id} existe: {jig_exists.numero_jig}")
            
            validation = Validacion(
                jig_id=jig_id,
                tecnico_id=tecnico_id,
                fecha=validation_fecha,
                turno=validation_turno,
                estado=validation_data.get("estado", "OK"),
                comentario=validation_data.get("comentario", ""),
                cantidad=validation_data.get("cantidad", 1)
            )
            db.add(validation)
            created_validations.append(validation)
            print(f"✅ Validación {i+1} creada exitosamente - ID: {validation.id}")
        
        print(f"💾 Guardando {len(created_validations)} validaciones en la base de datos...")
        try:
            db.commit()
            print("✅ Validaciones guardadas exitosamente")
        except Exception as commit_error:
            print(f"❌ Error guardando validaciones: {commit_error}")
            import traceback
            print(f"🔍 Traceback commit: {traceback.format_exc()}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error guardando validaciones: {str(commit_error)}"
            )
        
        # Generar PDF del reporte por lotes
        print("📄 Generando PDF del reporte...")
        try:
            # Usar firma del frontend primero, luego de la BD como fallback
            signature_data = report_data.get('signature_data')
            if not signature_data:
                # Fallback: obtener firma del perfil del técnico
                tecnico = db.query(Tecnico).filter(Tecnico.id == report_data.get('tecnico_id', 1)).first()
                signature_data = tecnico.firma_digital if tecnico else None
            
            print(f"🔍 Debug Firma en Backend:")
            print(f"  signature_data del frontend: {bool(report_data.get('signature_data'))}")
            print(f"  signature_data length: {len(signature_data) if signature_data else 0}")
            print(f"  signature_data type: {type(signature_data)}")
            
            # Obtener las validaciones creadas con sus relaciones desde la BD
            db.commit()  # Asegurar que las validaciones estén guardadas
            
            print(f"📋 IDs de validaciones creadas: {[v.id for v in created_validations]}")
            
            from sqlalchemy.orm import joinedload
            # Obtener las validaciones recién creadas con la relación jig cargada
            created_validations_with_jigs = db.query(Validacion).options(
                joinedload(Validacion.jig)
            ).filter(
                Validacion.id.in_([v.id for v in created_validations])
            ).all()
            
            print(f"📋 Usando datos de BD para PDF")
            print(f"📋 Validaciones en BD: {len(created_validations_with_jigs)}")
            for i, v in enumerate(created_validations_with_jigs):
                print(f"  {i+1}. ID: {v.id}, Jig: {v.jig.numero_jig if v.jig else 'N/A'}, Estado: {v.estado}")
                if v.jig:
                    print(f"     Jig ID: {v.jig.id}, Tipo: {v.jig.tipo}, Modelo: {v.jig.modelo_actual}")
                else:
                    print(f"     ❌ Relación jig no cargada")
            
            # Preparar datos para el PDF usando las validaciones de la BD
            pdf_data = {
                'fecha': fecha,
                'turno': turno,
                'tecnico': report_data.get('tecnico', 'N/A'),
                'tecnico_id': report_data.get('tecnico_id', 1),
                'modelo': modelo,
                'signature_data': signature_data,  # Usar firma del perfil del técnico
                'validaciones': [  # Cambiar de 'validations' a 'validaciones'
                    {
                        'numero_jig': v.jig.numero_jig if v.jig else 'N/A',
                        'tipo': v.jig.tipo if v.jig else 'N/A',
                        'estado': v.estado,
                        'comentario': v.comentario or 'Sin comentarios',
                        'turno': v.turno,
                        'created_at': v.fecha.isoformat() if v.fecha else ''
                    } for v in created_validations_with_jigs
                ]
            }
            print(f"📋 Datos para PDF: {pdf_data}")
            
            pdf_path = generate_batch_validation_report_pdf(pdf_data)
            print(f"✅ PDF generado exitosamente: {pdf_path}")
        except Exception as pdf_error:
            print(f"❌ Error generando PDF: {pdf_error}")
            import traceback
            print(f"🔍 Traceback completo: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error generando PDF: {str(pdf_error)}"
            )
        
        # Subir a Asana
        print("📤 Subiendo a Asana...")
        try:
            asana_url = await upload_to_asana(pdf_path, f"Validación Modelo {modelo} - {fecha}")
            print(f"✅ Subido a Asana: {asana_url}")
            return {
                "success": True,
                "modelo": modelo,
                "validations_count": len(created_validations),
                "pdf_filename": os.path.basename(pdf_path),
                "pdf_path": pdf_path,
                "asana_url": asana_url
            }
        except Exception as e:
            print(f"⚠️ Error subiendo a Asana: {e}")
            return {
                "success": True,
                "modelo": modelo,
                "validations_count": len(created_validations),
                "pdf_filename": os.path.basename(pdf_path),
                "pdf_path": pdf_path,
                "asana_error": str(e)
            }
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando reporte por lotes: {str(e)}"
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
