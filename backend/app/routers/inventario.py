from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from io import BytesIO
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch

from ..database import get_db
from ..models.models import Adaptador, ConectorAdaptador, Tecnico
from ..auth import get_current_user

router = APIRouter()

def ensure_gestion_or_admin(current_user: Tecnico):
    """Solo usuarios de gestión, admin o ingeniero pueden acceder"""
    if current_user.tipo_usuario not in ["admin", "gestion", "ingeniero"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administradores, gestión o ingenieros pueden generar inventarios"
        )

@router.get("/generar-pdf")
async def generar_inventario_pdf(
    nombre_inventario: str = "Inventario General",
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Genera un PDF con el inventario completo de herramientas"""
    ensure_gestion_or_admin(current_user)

    # Obtener todos los adaptadores con sus conectores
    adaptadores = db.query(Adaptador).filter(Adaptador.estado == "activo").all()

    # Agrupar conectores por tipo (modelo_adaptador)
    inventario = {}

    for adaptador in adaptadores:
        tipo = adaptador.modelo_adaptador
        if tipo not in inventario:
            inventario[tipo] = {
                'qty': 0,
                'ok': 0,
                'ng': 0,
                'ng_detalles': []
            }

        inventario[tipo]['qty'] += 1

        # Verificar estado de los conectores
        tiene_ng = False
        ng_comentarios = []

        for conector in adaptador.conectores:
            if conector.estado == "NG":
                tiene_ng = True
                detalle = f"{adaptador.numero_adaptador} - {conector.nombre_conector}"
                if conector.comentario_ng:
                    detalle += f": {conector.comentario_ng}"
                ng_comentarios.append(detalle)

        if tiene_ng:
            inventario[tipo]['ng'] += 1
            inventario[tipo]['ng_detalles'].extend(ng_comentarios)
        else:
            inventario[tipo]['ok'] += 1

    # Generar PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), topMargin=0.5*inch, bottomMargin=0.5*inch)
    elements = []

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20,
        alignment=1  # Center
    )

    # Título
    fecha_actual = datetime.now().strftime("%d/%m/%Y %H:%M")
    elements.append(Paragraph(f"{nombre_inventario}", title_style))
    elements.append(Paragraph(f"Fecha: {fecha_actual}", styles['Normal']))
    elements.append(Paragraph(f"Generado por: {current_user.nombre}", styles['Normal']))
    elements.append(Spacer(1, 20))

    # Tabla principal
    data = [['Tool', 'Qty', 'OK', 'NG', 'NG Detalles']]

    # Ordenar por tipo de herramienta
    for tipo in sorted(inventario.keys()):
        info = inventario[tipo]
        ng_detalles = '\n'.join(info['ng_detalles'][:5])  # Máximo 5 detalles
        if len(info['ng_detalles']) > 5:
            ng_detalles += f"\n... y {len(info['ng_detalles']) - 5} más"

        data.append([
            tipo,
            str(info['qty']),
            str(info['ok']),
            str(info['ng']),
            ng_detalles or '-'
        ])

    # Fila de totales
    total_qty = sum(info['qty'] for info in inventario.values())
    total_ok = sum(info['ok'] for info in inventario.values())
    total_ng = sum(info['ng'] for info in inventario.values())
    data.append(['TOTAL', str(total_qty), str(total_ok), str(total_ng), ''])

    # Crear tabla
    col_widths = [2*inch, 0.7*inch, 0.7*inch, 0.7*inch, 5*inch]
    table = Table(data, colWidths=col_widths)

    # Estilo de tabla
    table_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2D7FF9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (4, 1), (4, -1), 'LEFT'),  # Detalles alineados a la izquierda
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E8E8E8')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ])

    # Colorear filas con NG en rojo claro
    for i, row in enumerate(data[1:-1], start=1):
        if int(row[3]) > 0:  # Si hay NG
            table_style.add('BACKGROUND', (0, i), (-1, i), colors.HexColor('#FFE6E6'))

    table.setStyle(table_style)
    elements.append(table)

    # Construir PDF
    doc.build(elements)
    buffer.seek(0)

    # Nombre del archivo
    fecha_archivo = datetime.now().strftime("%Y%m%d_%H%M")
    filename = f"inventario_{fecha_archivo}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/resumen")
async def obtener_resumen_inventario(
    db: Session = Depends(get_db),
    current_user: Tecnico = Depends(get_current_user)
):
    """Obtiene un resumen del inventario sin generar PDF"""
    ensure_gestion_or_admin(current_user)

    adaptadores = db.query(Adaptador).filter(Adaptador.estado == "activo").all()

    inventario = {}

    for adaptador in adaptadores:
        tipo = adaptador.modelo_adaptador
        if tipo not in inventario:
            inventario[tipo] = {'qty': 0, 'ok': 0, 'ng': 0, 'ng_detalles': []}

        inventario[tipo]['qty'] += 1

        tiene_ng = False
        ng_comentarios = []

        for conector in adaptador.conectores:
            if conector.estado == "NG":
                tiene_ng = True
                detalle = {
                    'adaptador': adaptador.numero_adaptador,
                    'conector': conector.nombre_conector,
                    'comentario': conector.comentario_ng
                }
                ng_comentarios.append(detalle)

        if tiene_ng:
            inventario[tipo]['ng'] += 1
            inventario[tipo]['ng_detalles'].extend(ng_comentarios)
        else:
            inventario[tipo]['ok'] += 1

    # Convertir a lista para respuesta
    resultado = []
    for tipo, info in sorted(inventario.items()):
        resultado.append({
            'tool': tipo,
            'qty': info['qty'],
            'ok': info['ok'],
            'ng': info['ng'],
            'ng_detalles': info['ng_detalles']
        })

    total = {
        'qty': sum(info['qty'] for info in inventario.values()),
        'ok': sum(info['ok'] for info in inventario.values()),
        'ng': sum(info['ng'] for info in inventario.values())
    }

    return {
        'items': resultado,
        'total': total,
        'fecha': datetime.now().isoformat()
    }
