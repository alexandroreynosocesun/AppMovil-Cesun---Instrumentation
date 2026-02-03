"""
Servicio de notificaciones para Hisense CheckApp
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        # Configuración del servidor SMTP (puedes cambiar esto por tu proveedor de email)
        self.smtp_server = "smtp.gmail.com"  # Cambiar por tu servidor SMTP
        self.smtp_port = 587
        self.smtp_username = "tu_email@gmail.com"  # Cambiar por tu email
        self.smtp_password = "tu_password"  # Cambiar por tu contraseña de aplicación
        
    def send_registration_approved_notification(
        self, 
        usuario: str, 
        nombre: str, 
        email: Optional[str] = None
    ) -> bool:
        """
        Enviar notificación de que la solicitud de registro fue aprobada
        """
        try:
            if not email:
                # Si no hay email, solo loguear la notificación
                logger.info(f"✅ Usuario {usuario} ({nombre}) - Solicitud de registro aprobada")
                return True
                
            # Crear el mensaje
            subject = "✅ Solicitud de Registro Aprobada - Hisense CheckApp"
            
            body = f"""
            <html>
            <body>
                <h2>¡Felicidades! Tu solicitud de registro ha sido aprobada</h2>
                
                <p>Hola <strong>{nombre}</strong>,</p>
                
                <p>Tu solicitud de registro en Hisense CheckApp ha sido <strong>aprobada</strong>.</p>
                
                <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <h3>Información de tu cuenta:</h3>
                    <ul>
                        <li><strong>Usuario:</strong> {usuario}</li>
                        <li><strong>Nombre:</strong> {nombre}</li>
                        <li><strong>Estado:</strong> Activo</li>
                    </ul>
                </div>
                
                <p>Ya puedes iniciar sesión en la aplicación móvil con tus credenciales.</p>
                
                <p>Si tienes alguna pregunta, contacta al administrador del sistema.</p>
                
                <hr>
                <p style="color: #666; font-size: 12px;">
                    Este es un mensaje automático de Hisense CheckApp.
                </p>
            </body>
            </html>
            """
            
            # Crear el mensaje MIME
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.smtp_username
            msg['To'] = email
            
            # Agregar el cuerpo del mensaje
            html_part = MIMEText(body, 'html')
            msg.attach(html_part)
            
            # Enviar el email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"✅ Email de aprobación enviado a {email} para usuario {usuario}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error enviando notificación de aprobación: {e}")
            return False
    
    def send_registration_rejected_notification(
        self, 
        usuario: str, 
        nombre: str, 
        motivo: str,
        email: Optional[str] = None
    ) -> bool:
        """
        Enviar notificación de que la solicitud de registro fue rechazada
        """
        try:
            if not email:
                # Si no hay email, solo loguear la notificación
                logger.info(f"❌ Usuario {usuario} ({nombre}) - Solicitud de registro rechazada: {motivo}")
                return True
                
            # Crear el mensaje
            subject = "❌ Solicitud de Registro Rechazada - Hisense CheckApp"
            
            body = f"""
            <html>
            <body>
                <h2>Tu solicitud de registro ha sido revisada</h2>
                
                <p>Hola <strong>{nombre}</strong>,</p>
                
                <p>Tu solicitud de registro en Hisense CheckApp ha sido <strong>rechazada</strong>.</p>
                
                <div style="background-color: #ffe8e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <h3>Motivo del rechazo:</h3>
                    <p><strong>{motivo}</strong></p>
                </div>
                
                <p>Si crees que esto es un error o necesitas más información, contacta al administrador del sistema.</p>
                
                <hr>
                <p style="color: #666; font-size: 12px;">
                    Este es un mensaje automático de Hisense CheckApp.
                </p>
            </body>
            </html>
            """
            
            # Crear el mensaje MIME
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.smtp_username
            msg['To'] = email
            
            # Agregar el cuerpo del mensaje
            html_part = MIMEText(body, 'html')
            msg.attach(html_part)
            
            # Enviar el email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"✅ Email de rechazo enviado a {email} para usuario {usuario}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error enviando notificación de rechazo: {e}")
            return False

# Instancia global del servicio
notification_service = NotificationService()
