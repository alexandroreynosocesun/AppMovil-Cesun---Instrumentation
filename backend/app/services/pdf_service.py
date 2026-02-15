# Importaciones de reportlab
from reportlab.lib.pagesizes import A4  # type: ignore
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image  # type: ignore
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle  # type: ignore
from reportlab.lib.units import inch  # type: ignore
from reportlab.lib import colors  # type: ignore
from reportlab.lib.enums import TA_CENTER, TA_LEFT  # type: ignore
import base64
import io

from datetime import datetime
from zoneinfo import ZoneInfo
import os
from typing import List, Dict, Any

# Importaciones de modelos
from ..models.models import Validacion, Jig, Tecnico
from ..utils.logger import logger

def normalize_turno(turno: str) -> str:
    """Normalizar turno: convertir 'mañana', 'noche', 'fines' a 'A', 'B', 'C'"""
    if not turno:
        return 'N/A'
    turno_lower = turno.lower().strip()
    if turno_lower in ['mañana', 'manana', 'a']:
        return 'A'
    elif turno_lower in ['noche', 'b']:
        return 'B'
    elif turno_lower in ['fines', 'c']:
        return 'C'
    else:
        # Si ya es A, B o C, retornarlo en mayúsculas
        return turno.upper()

def generate_validation_pdf(validation: Validacion, jig: Jig, tecnico: Tecnico) -> str:
    """Generar PDF de validación individual"""
    
    # Crear directorio de reportes si no existe
    os.makedirs("reports", exist_ok=True)
    
    # Nombre del archivo
    filename = f"validation_{jig.numero_jig}_{validation.id}_{datetime.now(ZoneInfo("America/Tijuana")).strftime('%Y%m%d_%H%M%S')}.pdf"
    filepath = os.path.join("reports", filename)
    
    # Crear documento PDF
    doc = SimpleDocTemplate(filepath, pagesize=A4)
    story = []
    
    # Estilos
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.darkblue
    )
    
    # Encabezado
    story.append(Paragraph("REPORTE DE VALIDACIÓN DE JIG", title_style))
    story.append(Spacer(1, 20))
    
    # Información del jig
    jig_info = [
        ["Número de Jig:", jig.numero_jig],
        ["Tipo:", jig.tipo],
        ["Modelo:", jig.modelo_actual],
        ["Estado:", validation.estado],
        ["Técnico:", tecnico.nombre],
        ["Fecha:", validation.fecha.strftime('%d/%m/%Y %H:%M')],
        ["Comentario:", validation.comentario or "Sin comentarios"]
    ]
    
    jig_table = Table(jig_info, colWidths=[2*inch, 3*inch])
    jig_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(jig_table)
    story.append(Spacer(1, 30))
    
    # Información del técnico
    story.append(Paragraph("INFORMACIÓN DEL TÉCNICO", styles['Heading2']))
    tecnico_info = [
        ["Técnico:", tecnico.nombre],
        ["Número de Empleado:", tecnico.numero_empleado],
        ["Turno:", normalize_turno(validation.turno)]
    ]
    
    tecnico_table = Table(tecnico_info, colWidths=[2*inch, 3*inch])
    tecnico_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(tecnico_table)
    story.append(Spacer(1, 20))
    
    # "Firma" como texto: nombre completo + número de empleado
    firma_text = Paragraph("FIRMA DEL TÉCNICO", styles['Heading3'])
    story.append(firma_text)
    firma_line = Paragraph(
        f"{tecnico.nombre} - No. Empleado {tecnico.numero_empleado}",
        styles['Normal']
    )
    story.append(firma_line)
    
    # Pie de página
    story.append(Spacer(1, 30))
    footer_style = ParagraphStyle(
        'FooterStyle',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.grey
    )
    
    story.append(Paragraph(f"Reporte generado el: {datetime.now(ZoneInfo("America/Tijuana")).strftime('%d/%m/%Y %H:%M:%S')}", 
                          footer_style))
    story.append(Paragraph("Hisense CheckApp - Departamento de Instrumentación", 
                          footer_style))
    
    # Construir PDF
    doc.build(story)
    
    return filepath

def generate_turn_report_pdf(validations: List[Validacion], tecnico: Tecnico, turno: str, fecha: str) -> str:
    """Generar PDF de reporte por turno"""
    
    # Crear directorio de reportes si no existe
    os.makedirs("reports", exist_ok=True)
    
    # Nombre del archivo
    filename = f"reporte_turno_{turno}_{fecha}_{datetime.now(ZoneInfo("America/Tijuana")).strftime('%H%M%S')}.pdf"
    filepath = os.path.join("reports", filename)
    
    # Crear documento PDF
    doc = SimpleDocTemplate(filepath, pagesize=A4)
    story = []
    
    # Estilos
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.darkblue
    )
    
    # Encabezado
    story.append(Paragraph("REPORTE DE TURNO", title_style))
    story.append(Paragraph(f"Turno: {normalize_turno(turno)} - Fecha: {fecha}", styles['Heading2']))
    story.append(Spacer(1, 20))
    
    # Información del técnico
    story.append(Paragraph("INFORMACIÓN DEL TÉCNICO", styles['Heading2']))
    tecnico_info = [
        ["Técnico:", tecnico.nombre],
        ["Número de Empleado:", tecnico.numero_empleado],
        ["Total de Validaciones:", str(len(validations))]
    ]
    
    tecnico_table = Table(tecnico_info, colWidths=[2*inch, 3*inch])
    tecnico_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(tecnico_table)
    story.append(Spacer(1, 20))
    
    # Tabla de validaciones
    if validations:
        story.append(Paragraph("VALIDACIONES REALIZADAS", styles['Heading2']))
        
        validation_data = [["#", "JIG", "TIPO", "ESTADO", "COMENTARIO"]]
        
        for index, validation in enumerate(validations, 1):
            validation_data.append([
                str(index),
                validation.jig.numero_jig if validation.jig else "N/A",
                validation.jig.tipo if validation.jig else "N/A",
                validation.estado,
                validation.comentario or "Sin comentarios"
            ])
        
        validation_table = Table(validation_data, colWidths=[0.5*inch, 1*inch, 1*inch, 0.8*inch, 2.7*inch])
        validation_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(validation_table)
    else:
        no_data = Paragraph("No hay validaciones para este turno", styles['Normal'])
        story.append(no_data)
    
    # Resumen estadístico
    if validations:
        story.append(Spacer(1, 20))
        story.append(Paragraph("RESUMEN ESTADÍSTICO", styles['Heading2']))
        
        ok_count = sum(1 for v in validations if v.estado == 'OK')
        ng_count = sum(1 for v in validations if v.estado == 'NG')
        success_rate = (ok_count/len(validations)*100) if validations else 0
        
        summary_data = [
            ["Total de Jigs Validados:", str(len(validations))],
            ["Jigs OK:", str(ok_count)],
            ["Jigs NG:", str(ng_count)],
            ["Porcentaje de Éxito:", f"{success_rate:.1f}%"]
        ]
        
        summary_table = Table(summary_data, colWidths=[2*inch, 1*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(summary_table)
    
    # Pie de página
    story.append(Spacer(1, 30))
    footer_style = ParagraphStyle(
        'FooterStyle',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.grey
    )
    
    story.append(Paragraph(f"Reporte generado el: {datetime.now(ZoneInfo("America/Tijuana")).strftime('%d/%m/%Y %H:%M:%S')}", 
                          footer_style))
    story.append(Paragraph("Hisense CheckApp - Departamento de Instrumentación", 
                          footer_style))
    
    # Construir PDF
    doc.build(story)
    
    return filepath

def generate_validation_report_pdf(validations: List[Validacion], tecnico: Tecnico, turno: str, fecha: str) -> str:
    """Generar PDF de reporte de validación general"""
    
    # Crear directorio de reportes si no existe
    os.makedirs("reports", exist_ok=True)
    
    # Nombre del archivo
    filename = f"reporte_validacion_{fecha}_{turno}_{datetime.now(ZoneInfo("America/Tijuana")).strftime('%H%M%S')}.pdf"
    filepath = os.path.join("reports", filename)
    
    # Crear documento PDF
    doc = SimpleDocTemplate(filepath, pagesize=A4)
    story = []
    
    # Estilos
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        spaceAfter=30,
        alignment=TA_CENTER,
        textColor=colors.darkblue
    )
    
    # Encabezado
    story.append(Paragraph("REPORTE DE VALIDACIÓN - HISENSE CHECKAPP", title_style))
    story.append(Paragraph(f"Fecha: {fecha} - Turno: {normalize_turno(turno)}", styles['Heading2']))
    story.append(Spacer(1, 20))
    
    # Información del técnico
    story.append(Paragraph("INFORMACIÓN DEL TÉCNICO", styles['Heading2']))
    tecnico_info = [
        ["Técnico:", tecnico.nombre],
        ["Número de Empleado:", tecnico.numero_empleado],
        ["Total de Validaciones:", str(len(validations))]
    ]
    
    tecnico_table = Table(tecnico_info, colWidths=[2*inch, 3*inch])
    tecnico_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(tecnico_table)
    story.append(Spacer(1, 20))
    
    # Tabla de validaciones
    if validations:
        story.append(Paragraph("VALIDACIONES REALIZADAS", styles['Heading2']))
        
        validation_data = [["#", "JIG", "TIPO", "ESTADO", "COMENTARIO"]]
        
        for index, validation in enumerate(validations, 1):
            validation_data.append([
                str(index),
                validation.jig.numero_jig if validation.jig else "N/A",
                validation.jig.tipo if validation.jig else "N/A",
                validation.estado,
                validation.comentario or "Sin comentarios"
            ])
        
        validation_table = Table(validation_data, colWidths=[0.5*inch, 1*inch, 1*inch, 0.8*inch, 2.7*inch])
        validation_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(validation_table)
    else:
        no_data = Paragraph("No hay validaciones para este reporte", styles['Normal'])
        story.append(no_data)
    
    # Resumen estadístico
    if validations:
        story.append(Spacer(1, 20))
        story.append(Paragraph("RESUMEN ESTADÍSTICO", styles['Heading2']))
        
        ok_count = sum(1 for v in validations if v.estado == 'OK')
        ng_count = sum(1 for v in validations if v.estado == 'NG')
        success_rate = (ok_count/len(validations)*100) if validations else 0
        
        summary_data = [
            ["Total de Jigs Validados:", str(len(validations))],
            ["Jigs OK:", str(ok_count)],
            ["Jigs NG:", str(ng_count)],
            ["Porcentaje de Éxito:", f"{success_rate:.1f}%"]
        ]
        
        summary_table = Table(summary_data, colWidths=[2*inch, 1*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(summary_table)
    
    # Pie de página
    story.append(Spacer(1, 30))
    footer_style = ParagraphStyle(
        'FooterStyle',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.grey
    )
    
    story.append(Paragraph(f"Reporte generado el: {datetime.now(ZoneInfo("America/Tijuana")).strftime('%d/%m/%Y %H:%M:%S')}", 
                          footer_style))
    story.append(Paragraph("Hisense CheckApp - Departamento de Instrumentación", 
                          footer_style))
    
    # Construir PDF
    doc.build(story)
    
    return filepath

def generate_batch_validation_report_pdf(report_data: dict) -> str:
    """Generar PDF de reporte de validación por lotes (múltiples jigs del mismo modelo)"""
    
    try:
        # Validar que report_data es un diccionario
        if not isinstance(report_data, dict):
            raise ValueError(f"report_data debe ser un diccionario, recibido: {type(report_data)}")
        
        logger.debug(f"Generando PDF - report_data keys: {list(report_data.keys())}")
        
        # Crear directorio de reportes si no existe
        from ..config import REPORTS_DIR
        os.makedirs(REPORTS_DIR, exist_ok=True)
        
        # Nombre del archivo (limpiar caracteres inválidos)
        modelo = report_data.get('modelo', 'unknown')
        fecha_raw = report_data.get('fecha', datetime.now(ZoneInfo("America/Tijuana")).strftime('%Y%m%d'))
        
        logger.debug(f"Generando PDF - Modelo: {modelo}, Fecha: {fecha_raw}")
        
        # Formatear fecha legible para nombre de archivo (DD-MM-YYYY)
        try:
            if 'T' in str(fecha_raw):
                fecha_obj = datetime.fromisoformat(str(fecha_raw).replace('Z', '+00:00'))
            else:
                fecha_obj = datetime.strptime(str(fecha_raw).replace('/', '-'), '%Y-%m-%d')
            fecha_legible = fecha_obj.strftime('%d-%m-%Y')
        except Exception:
            fecha_legible = str(fecha_raw).replace('/', '-').replace(':', '-')

        turno = report_data.get('turno', '').upper()
        linea = report_data.get('linea', '')

        # Construir nombre descriptivo: Reporte_52936_11-02-2026_T1_L3.pdf
        partes = [modelo, fecha_legible]
        if turno:
            partes.append(f"T{turno}")
        if linea and linea != '-' and linea.strip():
            partes.append(f"L{linea.strip()}")

        filename = f"Reporte_{'_'.join(partes)}.pdf"
        filepath = os.path.join(REPORTS_DIR, filename)
        
        # Crear documento PDF
        doc = SimpleDocTemplate(filepath, pagesize=A4)
        story = []
        
        # Estilos
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.darkblue
        )
        
        header_style = ParagraphStyle(
            'CustomHeader',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=12,
            textColor=colors.darkblue
        )
        
        # Encabezado de la empresa
        story.append(Paragraph("DEPARTAMENTO DE INSTRUMENTACIÓN", title_style))
        story.append(Paragraph("REPORTE DE VALIDACIÓN - HISENSE CHECKAPP", header_style))
        story.append(Spacer(1, 20))
        
        # Formatear fecha para mostrar solo la fecha (sin hora)
        fecha_raw = report_data.get('fecha', '')
        if isinstance(fecha_raw, str) and 'T' in fecha_raw:
            fecha_display = fecha_raw.split('T')[0]  # Solo la fecha, sin hora
        elif isinstance(fecha_raw, str):
            fecha_display = fecha_raw.split(' ')[0] if ' ' in fecha_raw else fecha_raw
        else:
            fecha_display = str(fecha_raw)
        
        # Obtener validaciones primero
        validations = report_data.get('validaciones', [])
        if not validations:
            validations = []
        
        # Obtener la línea del report_data (ya viene incluida desde el backend)
        linea = report_data.get('linea', '-')
        # Si no viene en report_data o está vacía, intentar obtenerla de la primera validación
        if (not linea or linea == '-' or linea == '') and validations and len(validations) > 0:
            linea_temp = validations[0].get('linea', '-')
            if linea_temp and linea_temp != '-' and linea_temp != '':
                linea = linea_temp
        
        # Asegurar que linea sea un string válido
        if not linea or linea == '-':
            linea = '-'
        else:
            linea = str(linea).strip()
        
        print(f"📋 PDF - Línea final: '{linea}'")
        print(f"📋 PDF - Total validaciones: {len(validations)}")
        
        # Información del reporte en formato de estado de cuenta
        report_info = [
            ["Modelo:", modelo, "Fecha:", fecha_display],
            ["Turno:", normalize_turno(report_data.get('turno', '')), "Técnico:", report_data.get('tecnico', '')],
            ["Línea:", linea, "Total de Jigs:", str(len(validations))]
        ]
        
        report_table = Table(report_info, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
        report_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('BACKGROUND', (2, 0), (2, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTNAME', (3, 0), (3, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 0), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(report_table)
        story.append(Spacer(1, 20))
        
        # Tabla de validaciones en formato vertical
        story.append(Paragraph("DETALLE DE VALIDACIONES", header_style))
        
        if validations:
            # Crear tabla de validaciones con numeración consecutiva (sin columna LÍNEA)
            validation_data = [["#", "JIG", "TIPO", "ESTADO", "TURNO", "COMENTARIO"]]
            
            for index, validation in enumerate(validations, 1):
                validation_data.append([
                    str(index),
                    validation.get('numero_jig', ''),
                    validation.get('tipo', '').upper(),
                    validation.get('estado', ''),
                    normalize_turno(validation.get('turno', '')),
                    validation.get('comentario', 'Sin comentarios')[:40] + '...' if len(validation.get('comentario', '')) > 40 else validation.get('comentario', 'Sin comentarios')
                ])
            
            validation_table = Table(validation_data, colWidths=[0.5*inch, 0.8*inch, 1*inch, 0.6*inch, 0.6*inch, 3*inch])
            validation_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                # Colorear filas alternadas
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
                # Colorear estados
                ('TEXTCOLOR', (3, 1), (3, -1), colors.black),
            ]))
            
            story.append(validation_table)
        else:
            no_data = Paragraph("No hay validaciones para este lote", styles['Normal'])
            story.append(no_data)
        
        story.append(Spacer(1, 30))
        
        # Resumen estadístico en formato de estado de cuenta
        if validations:
            ok_count = sum(1 for v in validations if v.get('estado') == 'OK')
            ng_count = sum(1 for v in validations if v.get('estado') == 'NG')
            success_rate = (ok_count/len(validations)*100) if validations else 0
            
            story.append(Paragraph("RESUMEN ESTADÍSTICO", header_style))
            
            summary_data = [
                ["Total de Jigs Validados:", str(len(validations)), "Jigs OK:", str(ok_count)],
                ["Jigs NG:", str(ng_count), "Porcentaje de Éxito:", f"{success_rate:.1f}%"]
            ]
            
            summary_table = Table(summary_data, colWidths=[2*inch, 1*inch, 2*inch, 1*inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
                ('BACKGROUND', (2, 0), (2, -1), colors.lightgrey),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
                ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
                ('FONTNAME', (3, 0), (3, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('BACKGROUND', (0, 0), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            story.append(summary_table)
        
        # Sección de firma del técnico
        story.append(Spacer(1, 40))
        
        # Estilo para la firma
        signature_style = ParagraphStyle(
            'SignatureStyle',
            parent=styles['Normal'],
            fontSize=12,
            alignment=TA_CENTER,
            textColor=colors.black
        )
        
        # Información del técnico
        tecnico_nombre = report_data.get('tecnico', 'N/A')
        tecnico_numero_empleado = report_data.get('numero_empleado', 'N/A')
        
        # Formatear fecha para mostrar solo la fecha (sin hora)
        fecha_firma_raw = report_data.get('fecha', '')
        if isinstance(fecha_firma_raw, str) and 'T' in fecha_firma_raw:
            fecha_firma_display = fecha_firma_raw.split('T')[0]  # Solo la fecha, sin hora
        elif isinstance(fecha_firma_raw, str):
            fecha_firma_display = fecha_firma_raw.split(' ')[0] if ' ' in fecha_firma_raw else fecha_firma_raw
        else:
            fecha_firma_display = str(fecha_firma_raw)
        
        # Firma del técnico: nombre, número de empleado y fecha
        story.append(Paragraph("FIRMA DEL TÉCNICO", styles['Heading3']))
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"{tecnico_nombre}", signature_style))
        story.append(Paragraph(f"No. Empleado: {tecnico_numero_empleado}", signature_style))
        story.append(Paragraph(f"Fecha: {fecha_firma_display}", signature_style))
        story.append(Spacer(1, 10))
        story.append(Paragraph("_________________________", signature_style))
        
        # Pie de página profesional
        story.append(Spacer(1, 30))
        
        footer_style = ParagraphStyle(
            'FooterStyle',
            parent=styles['Normal'],
            fontSize=8,
            alignment=TA_CENTER,
            textColor=colors.grey
        )
        
        story.append(Paragraph(f"Reporte generado el: {datetime.now(ZoneInfo("America/Tijuana")).strftime('%d/%m/%Y %H:%M:%S')}", 
                              footer_style))
        story.append(Paragraph("Hisense CheckApp - Departamento de Instrumentación", 
                              footer_style))
        
        # Construir PDF
        doc.build(story)
        
        return filepath
        
    except Exception as e:
        error_message = str(e) if str(e) else f"{type(e).__name__}: Error desconocido"
        logger.error(f"Error generando PDF de reporte por lotes: {error_message}", exc_info=True)
        # Lanzar la excepción para que el router la maneje
        raise Exception(f"Error generando PDF: {error_message}")
