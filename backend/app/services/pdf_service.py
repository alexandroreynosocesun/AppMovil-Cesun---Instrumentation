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
import os
from typing import List, Dict, Any

# Importaciones de modelos
from ..models.models import Validacion, Jig, Tecnico

def process_signature_image(signature_data):
    """Procesar imagen de firma desde base64"""
    try:
        if not signature_data:
            print("❌ No hay signature_data")
            return None
            
        print(f"🔍 Procesando firma - Longitud: {len(signature_data)}")
        print(f"🔍 Firma comienza con: {signature_data[:50]}...")
        
        # Remover el prefijo data:image si existe
        if signature_data.startswith('data:image'):
            signature_data = signature_data.split(',')[1]
            print(f"🔍 Removido prefijo data:image, nueva longitud: {len(signature_data)}")
        
        # Decodificar base64
        signature_bytes = base64.b64decode(signature_data)
        print(f"🔍 Bytes decodificados: {len(signature_bytes)} bytes")
        
        # Crear objeto de imagen temporal
        signature_io = io.BytesIO(signature_bytes)
        
        # Crear imagen de reportlab
        signature_img = Image(signature_io)
        print(f"🔍 Imagen creada - Ancho: {signature_img.drawWidth}, Alto: {signature_img.drawHeight}")
        
        # Redimensionar la firma (ancho máximo 3 pulgadas)
        original_width = signature_img.drawWidth
        signature_img.drawWidth = min(signature_img.drawWidth, 3 * inch)
        
        # Corregir el cálculo de altura
        if original_width > 0:
            ratio = signature_img.drawWidth / original_width
            signature_img.drawHeight = signature_img.drawHeight * ratio
        
        print(f"🔍 Imagen redimensionada - Ancho: {signature_img.drawWidth}, Alto: {signature_img.drawHeight}")
        
        return signature_img
    except Exception as e:
        print(f"❌ Error procesando firma: {e}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        return None

def generate_validation_pdf(validation: Validacion, jig: Jig, tecnico: Tecnico) -> str:
    """Generar PDF de validación individual"""
    
    # Crear directorio de reportes si no existe
    os.makedirs("reports", exist_ok=True)
    
    # Nombre del archivo
    filename = f"validation_{jig.numero_jig}_{validation.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
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
    
    # Información del técnico y firma
    story.append(Paragraph("INFORMACIÓN DEL TÉCNICO", styles['Heading2']))
    tecnico_info = [
        ["Técnico:", tecnico.nombre],
        ["Número de Empleado:", tecnico.numero_empleado],
        ["Turno:", validation.turno]
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
    
    # Firma digital si existe
    if tecnico.firma_digital:
        firma_text = Paragraph("Firma Digital del Técnico:", styles['Heading3'])
        story.append(firma_text)
        
        # Aquí se podría agregar la imagen de la firma si está en base64
        firma_info = Paragraph(f"Firma: {tecnico.firma_digital[:50]}...", styles['Normal'])
        story.append(firma_info)
    
    # Pie de página
    story.append(Spacer(1, 30))
    footer_style = ParagraphStyle(
        'FooterStyle',
        parent=styles['Normal'],
        fontSize=8,
        alignment=TA_CENTER,
        textColor=colors.grey
    )
    
    story.append(Paragraph(f"Reporte generado el: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}", 
                          footer_style))
    story.append(Paragraph("Sistema de Validación de Jigs - Departamento de Instrumentación", 
                          footer_style))
    
    # Construir PDF
    doc.build(story)
    
    return filepath

def generate_turn_report_pdf(validations: List[Validacion], tecnico: Tecnico, turno: str, fecha: str) -> str:
    """Generar PDF de reporte por turno"""
    
    # Crear directorio de reportes si no existe
    os.makedirs("reports", exist_ok=True)
    
    # Nombre del archivo
    filename = f"reporte_turno_{turno}_{fecha}_{datetime.now().strftime('%H%M%S')}.pdf"
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
    story.append(Paragraph(f"Turno: {turno} - Fecha: {fecha}", styles['Heading2']))
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
    
    story.append(Paragraph(f"Reporte generado el: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}", 
                          footer_style))
    story.append(Paragraph("Sistema de Validación de Jigs - Departamento de Instrumentación", 
                          footer_style))
    
    # Construir PDF
    doc.build(story)
    
    return filepath

def generate_validation_report_pdf(validations: List[Validacion], tecnico: Tecnico, turno: str, fecha: str) -> str:
    """Generar PDF de reporte de validación general"""
    
    # Crear directorio de reportes si no existe
    os.makedirs("reports", exist_ok=True)
    
    # Nombre del archivo
    filename = f"reporte_validacion_{fecha}_{turno}_{datetime.now().strftime('%H%M%S')}.pdf"
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
    story.append(Paragraph("REPORTE DE VALIDACIÓN DE JIGS", title_style))
    story.append(Paragraph(f"Fecha: {fecha} - Turno: {turno}", styles['Heading2']))
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
    
    story.append(Paragraph(f"Reporte generado el: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}", 
                          footer_style))
    story.append(Paragraph("Sistema de Validación de Jigs - Departamento de Instrumentación", 
                          footer_style))
    
    # Construir PDF
    doc.build(story)
    
    return filepath

def generate_batch_validation_report_pdf(report_data: dict) -> str:
    """Generar PDF de reporte de validación por lotes (múltiples jigs del mismo modelo)"""
    
    try:
        # Crear directorio de reportes si no existe
        os.makedirs("reports", exist_ok=True)
        
        # Nombre del archivo (limpiar caracteres inválidos)
        modelo = report_data.get('modelo', 'unknown')
        fecha_raw = report_data.get('fecha', datetime.now().strftime('%Y%m%d'))
        
        # Limpiar fecha de caracteres inválidos para nombre de archivo
        if 'T' in str(fecha_raw):
            fecha_clean = str(fecha_raw).split('T')[0].replace('-', '')
        else:
            fecha_clean = str(fecha_raw).replace('-', '').replace(':', '').replace(' ', '')
        
        filename = f"reporte_lote_{modelo}_{fecha_clean}_{datetime.now().strftime('%H%M%S')}.pdf"
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
        
        header_style = ParagraphStyle(
            'CustomHeader',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=12,
            textColor=colors.darkblue
        )
        
        # Encabezado de la empresa
        story.append(Paragraph("DEPARTAMENTO DE INSTRUMENTACIÓN", title_style))
        story.append(Paragraph("REPORTE DE VALIDACIÓN DE JIGS", header_style))
        story.append(Spacer(1, 20))
        
        # Información del reporte en formato de estado de cuenta
        report_info = [
            ["Modelo:", modelo, "Fecha:", report_data.get('fecha', '')],
            ["Turno:", report_data.get('turno', ''), "Técnico:", report_data.get('tecnico', '')],
            ["Total de Jigs:", str(len(report_data.get('validaciones', []))), "", ""]
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
        
        validations = report_data.get('validaciones', [])
        if validations:
            # Crear tabla de validaciones con numeración consecutiva
            validation_data = [["#", "JIG", "TIPO", "ESTADO", "TURNO", "COMENTARIO"]]
            
            for index, validation in enumerate(validations, 1):
                validation_data.append([
                    str(index),
                    validation.get('numero_jig', ''),
                    validation.get('tipo', '').upper(),
                    validation.get('estado', ''),
                    validation.get('turno', ''),
                    validation.get('comentario', 'Sin comentarios')[:40] + '...' if len(validation.get('comentario', '')) > 40 else validation.get('comentario', 'Sin comentarios')
                ])
            
            validation_table = Table(validation_data, colWidths=[0.5*inch, 0.8*inch, 1*inch, 0.6*inch, 0.6*inch, 2.5*inch])
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
        
        # Línea de firma
        signature_style = ParagraphStyle(
            'SignatureStyle',
            parent=styles['Normal'],
            fontSize=12,
            alignment=TA_CENTER,
            textColor=colors.black
        )
        
        # Información del técnico
        tecnico_nombre = report_data.get('tecnico', 'N/A')
        
        # Procesar firma digital si existe
        signature_data = report_data.get('signature_data')
        print(f"🔍 Debug PDF Service - Firma:")
        print(f"  signature_data existe: {bool(signature_data)}")
        print(f"  signature_data length: {len(signature_data) if signature_data else 0}")
        print(f"  signature_data type: {type(signature_data)}")
        
        if signature_data:
            print(f"  Procesando firma digital...")
            signature_img = process_signature_image(signature_data)
            if signature_img:
                print(f"  ✅ Firma procesada exitosamente")
                story.append(Paragraph("Firma Digital del Técnico:", signature_style))
                story.append(Spacer(1, 10))
                story.append(signature_img)
                story.append(Spacer(1, 10))
            else:
                print(f"  ❌ Error procesando firma")
                story.append(Paragraph("_________________________", signature_style))
                story.append(Spacer(1, 10))
        else:
            print(f"  ❌ No hay firma digital")
            story.append(Paragraph("_________________________", signature_style))
            story.append(Spacer(1, 10))
        
        story.append(Paragraph(f"Firma del Técnico", signature_style))
        story.append(Paragraph(f"{tecnico_nombre}", signature_style))
        story.append(Paragraph(f"Turno: {report_data.get('turno', 'N/A')}", signature_style))
        story.append(Paragraph(f"Fecha: {report_data.get('fecha', 'N/A')}", signature_style))
        
        # Pie de página profesional
        story.append(Spacer(1, 30))
        
        footer_style = ParagraphStyle(
            'FooterStyle',
            parent=styles['Normal'],
            fontSize=8,
            alignment=TA_CENTER,
            textColor=colors.grey
        )
        
        story.append(Paragraph(f"Reporte generado el: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}", 
                              footer_style))
        story.append(Paragraph("Sistema de Validación de Jigs - Departamento de Instrumentación", 
                              footer_style))
        
        # Construir PDF
        doc.build(story)
        
        return filepath
        
    except Exception as e:
        print(f"Error generando PDF: {e}")
        # Crear un PDF de error
        error_filename = f"error_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        error_filepath = os.path.join("reports", error_filename)
        
        # Crear PDF simple de error
        error_doc = SimpleDocTemplate(error_filepath, pagesize=A4)
        error_story = []
        error_story.append(Paragraph("ERROR GENERANDO REPORTE", title_style))
        error_story.append(Paragraph(f"Error: {str(e)}", styles['Normal']))
        error_doc.build(error_story)
        
        return error_filepath
