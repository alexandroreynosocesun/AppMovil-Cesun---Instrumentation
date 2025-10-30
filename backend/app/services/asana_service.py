import requests
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

class AsanaService:
    def __init__(self):
        self.api_key = os.getenv("ASANA_API_KEY")
        self.base_url = "https://app.asana.com/api/1.0"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    def upload_file_to_task(self, file_path: str, task_name: str, project_id: str = None) -> bool:
        """Subir archivo a una tarea de Asana"""
        try:
            # Buscar o crear tarea
            task_id = self._find_or_create_task(task_name, project_id)
            if not task_id:
                print(f"No se pudo encontrar o crear la tarea: {task_name}")
                return False
            
            # Subir archivo
            upload_url = f"{self.base_url}/tasks/{task_id}/attachments"
            
            with open(file_path, 'rb') as file:
                files = {'file': file}
                headers = {"Authorization": f"Bearer {self.api_key}"}
                
                response = requests.post(upload_url, files=files, headers=headers)
                
                if response.status_code == 201:
                    print(f"Archivo subido exitosamente a la tarea {task_id}")
                    return True
                else:
                    print(f"Error subiendo archivo: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            print(f"Error en upload_file_to_task: {e}")
            return False
    
    def _find_or_create_task(self, task_name: str, project_id: str = None) -> Optional[str]:
        """Buscar tarea existente o crear nueva"""
        try:
            # Buscar tarea existente
            search_url = f"{self.base_url}/tasks"
            params = {
                "text": task_name,
                "opt_fields": "gid,name,projects"
            }
            
            response = requests.get(search_url, headers=self.headers, params=params)
            
            if response.status_code == 200:
                tasks = response.json().get("data", [])
                for task in tasks:
                    if task["name"].lower() == task_name.lower():
                        return task["gid"]
            
            # Si no se encuentra, crear nueva tarea
            if project_id:
                return self._create_task(task_name, project_id)
            else:
                print(f"No se encontró la tarea y no se proporcionó project_id para crear una nueva")
                return None
                
        except Exception as e:
            print(f"Error en _find_or_create_task: {e}")
            return None
    
    def _create_task(self, task_name: str, project_id: str) -> Optional[str]:
        """Crear nueva tarea en Asana"""
        try:
            create_url = f"{self.base_url}/tasks"
            data = {
                "name": task_name,
                "projects": [project_id],
                "notes": f"Tarea creada automáticamente para validación de jig: {task_name}"
            }
            
            response = requests.post(create_url, headers=self.headers, json=data)
            
            if response.status_code == 201:
                task_data = response.json()
                return task_data["data"]["gid"]
            else:
                print(f"Error creando tarea: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"Error en _create_task: {e}")
            return None
    
    def get_projects(self) -> list:
        """Obtener lista de proyectos de Asana"""
        try:
            projects_url = f"{self.base_url}/projects"
            params = {"opt_fields": "gid,name,workspace"}
            
            response = requests.get(projects_url, headers=self.headers, params=params)
            
            if response.status_code == 200:
                return response.json().get("data", [])
            else:
                print(f"Error obteniendo proyectos: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"Error en get_projects: {e}")
            return []

# Instancia global del servicio
asana_service = AsanaService()

def upload_to_asana(file_path: str, jig_number: str, validation_date) -> bool:
    """Función helper para subir archivo a Asana"""
    task_name = f"Validación Jig {jig_number} - {validation_date.strftime('%d/%m/%Y')}"
    project_id = os.getenv("ASANA_PROJECT_ID")  # ID del proyecto en Asana
    
    return asana_service.upload_file_to_task(file_path, task_name, project_id)
