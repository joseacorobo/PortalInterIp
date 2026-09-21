from typing import Dict, List, Optional
import json

# Base de datos en memoria para el prototipo
COMMAND_DATABASE = {
    "FiberHome": {
        "basicos": [
            {
                "id": "fh_show_mac",
                "name": "Consultar MAC en Puerto",
                "description": "Muestra las MAC aprendidas en un puerto especifico.",
                "template": "show mac slot {slot} pon {pon} onu {onu}",
                "requires": ["slot", "pon", "onu"]
            },
            {
                "id": "fh_show_optic",
                "name": "Revisar Potencia Optica",
                "description": "Verifica los niveles de potencia optica del equipo cliente.",
                "template": "show optic_module slot {slot} pon {pon} onu {onu}",
                "requires": ["slot", "pon", "onu"]
            }
        ],
        "casos_router": [
            {
                "id": "fh_wan_config",
                "name": "Verificar Config. WAN Router",
                "description": "Revisa si la WAN est configurada en modo router.",
                "template": "show wan slot {slot} pon {pon} onu {onu}",
                "requires": ["slot", "pon", "onu"]
            }
        ]
    },
    "Huawei": {
        "basicos": [
            {
                "id": "hw_show_mac",
                "name": "Consultar MAC",
                "description": "Muestra la tabla de direcciones MAC.",
                "template": "display mac-address port {slot}/{pon}/{onu}",
                "requires": ["slot", "pon", "onu"]
            },
            {
                "id": "hw_show_optic",
                "name": "Revisar Potencia Optica",
                "description": "Muestra la informacion optica de la ONT.",
                "template": "display ont optical-info {slot} {pon} {onu}",
                "requires": ["slot", "pon", "onu"]
            }
        ]
    }
}

class CommandGenerator:
    @staticmethod
    def get_categories(vendor: str) -> List[str]:
        if vendor not in COMMAND_DATABASE:
            return []
        return list(COMMAND_DATABASE[vendor].keys())

    @staticmethod
    def get_commands(vendor: str, category: str) -> List[Dict]:
        if vendor not in COMMAND_DATABASE or category not in COMMAND_DATABASE[vendor]:
            return []
        return COMMAND_DATABASE[vendor][category]
    
    @staticmethod
    def generate(vendor: str, category: str, command_id: str, params: Dict[str, str]) -> Optional[str]:
        commands = CommandGenerator.get_commands(vendor, category)
        cmd = next((c for c in commands if c["id"] == command_id), None)
        
        if not cmd:
            return None
            
        template = cmd["template"]
        # Inyectar variables de forma segura
        try:
            return template.format(**params)
        except KeyError:
            return "Faltan parmetros requeridos (slot, pon, etc) para generar este comando."
