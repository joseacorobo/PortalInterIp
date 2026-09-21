import re

class TelcoEmailParser:
    """
    Algoritmo determinista y heurístico especializado en la topología y sintaxis
    operacional de Inter FTTH (Operaciones IP):
    - Número de Abonado: 10 dígitos exactos (2 primeros corresponden al Permisor).
    - Serial PON: 12 caracteres (FHTT = Inter/FiberHome, HWTC = Netuno/Huawei, SimpleTV/Otros).
    - OLT: Formato OLT - [3-4 Letras Acrónimo Ciudad] - [Número].
    - Slot/PON: Opcional (generalmente no se envía, se consulta en OLT vía Serial).
    - Modo Bridge / IP Certificada: Detección heurística en texto libre sin plantilla.
    """
    
    # 1. Serial PON (12 caracteres)
    # FHTT = Inter (FiberHome), HWTC = Netuno (Huawei), ZTEG = ZTE, otros 12 chars = SimpleTV/Terceros
    SERIAL_PATTERNS = [
        re.compile(r'\b(FHTT[0-9A-Fa-f]{8})\b', re.IGNORECASE),
        re.compile(r'\b(HWTC[0-9A-Fa-f]{8})\b', re.IGNORECASE),
        re.compile(r'\b(ZTEG[0-9A-Fa-f]{8})\b', re.IGNORECASE),
        re.compile(r'(?:Serial|SN|PON\s*(?:SN)?|ONU(?:\s*SN)?)[:\s\-_]*([A-Za-z0-9]{12})\b', re.IGNORECASE),
        re.compile(r'\b([A-Z]{3,4}[0-9A-Fa-f]{8,9})\b')
    ]
    
    # 2. Dirección MAC (IEEE 802 o Cisco)
    MAC_PATTERN = re.compile(r'\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b|\b[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\b')
    
    # 3. Código de Abonado (10 dígitos exactos, 2 primeros son el Permisor)
    SUBSCRIBER_10DIGIT_EXPLICIT = re.compile(r'\b(?:AB|Abonado|Cliente|Contrato|Cod(?:igo)?|ID|Sub)[:\s#\.\-_]*(\d{10})\b', re.IGNORECASE)
    SUBSCRIBER_GENERIC_EXPLICIT = re.compile(r'\b(?:AB|Abonado|Cliente|Contrato|Cod(?:igo)?|ID|Sub)[:\s#\.\-_]*(\d{6,10})\b', re.IGNORECASE)
    SUBSCRIBER_STANDALONE_10DIGIT = re.compile(r'\b(\d{10})\b')
    
    # 4. Formato OLT: OLT - [3-4 Letras Acrónimo Ciudad] - [Número]
    OLT_ACRONYM_PATTERN = re.compile(r'\bOLT[\s\-_]*([A-Za-z]{3,4})[\s\-_]*(\d{1,2})\b', re.IGNORECASE)
    OLT_GENERIC_PATTERN = re.compile(r'\b(OLT[\-_][A-Za-z0-9\-_]+)\b', re.IGNORECASE)
    
    # 5. Potencia Óptica (dBm)
    POWER_PATTERN = re.compile(r'([-+]?\d{1,2}(?:\.\d{1,2})?)\s*(?:dBm|dbm|dB)', re.IGNORECASE)

    @classmethod
    def parse(cls, text: str) -> dict:
        result = {
            "subscriber_code": None,
            "permisor": None,
            "permisor_info": None,
            "serial_pon": None,
            "vendor": "Desconocido",
            "technology": "GPON FTTH",
            "node_name": None,
            "slot": None,
            "pon": None,
            "onu_id": None,
            "slot_pon": "Consultar en OLT vía Serial PON",  # Por defecto si no lo envían
            "mac_address": "No provista (Usar Serial PON)",
            "optical_power": None,
            "detected_area": "Soporte",
            "suggested_task_code": "P2-SOP-01",
            "suggested_task_name": "Operación Estándar",
            "suggested_points": 2,
            "is_bridge": False,
            "is_critical": False,
            "matched_keywords": []
        }
        
        lower_text = text.lower()
        
        # --- 1. EXTRACCIÓN DE SERIAL PON (12 Caracteres) ---
        for pat in cls.SERIAL_PATTERNS:
            m = pat.search(text)
            if m:
                serial = m.group(1).replace("-", "").replace(" ", "").upper()
                result["serial_pon"] = serial
                if serial.startswith("FHTT"):
                    result["vendor"] = "FiberHome (Red Inter)"
                elif serial.startswith("HWTC"):
                    result["vendor"] = "Huawei (Red Netuno)"
                elif serial.startswith("ZTEG"):
                    result["vendor"] = "ZTE"
                else:
                    result["vendor"] = "SimpleTV / Terceros (12 Caracteres)"
                break
                
        # --- 2. EXTRACCIÓN DE NÚMERO DE ABONADO (10 Dígitos + Permisor) ---
        # Prioridad 1: Con etiqueta AB/Abonado y 10 dígitos
        m_sub = cls.SUBSCRIBER_10DIGIT_EXPLICIT.search(text)
        if not m_sub:
            # Prioridad 2: Número de 10 dígitos aislado en el texto
            m_sub = cls.SUBSCRIBER_STANDALONE_10DIGIT.search(text)
        if not m_sub:
            # Prioridad 3: Etiqueta explícita con menos dígitos (fallback)
            m_sub = cls.SUBSCRIBER_GENERIC_EXPLICIT.search(text)
            
        if m_sub:
            sub_str = m_sub.group(1)
            result["subscriber_code"] = sub_str
            if len(sub_str) >= 2:
                permisor = sub_str[:2]
                result["permisor"] = permisor
                result["permisor_info"] = f"Permisor {permisor}"
                
        # --- 3. EXTRACCIÓN Y NORMALIZACIÓN DE NODO OLT ---
        # Formato canónico: OLT - [3-4 Letras] - [Número]
        m_olt_acro = cls.OLT_ACRONYM_PATTERN.search(text)
        if m_olt_acro:
            city_code = m_olt_acro.group(1).upper()
            num_code = str(m_olt_acro.group(2)).zfill(2)
            result["node_name"] = f"OLT-{city_code}-{num_code}"
        else:
            m_olt_gen = cls.OLT_GENERIC_PATTERN.search(text)
            if m_olt_gen:
                result["node_name"] = m_olt_gen.group(1).upper()
                
        # --- 4. EXTRACCIÓN DE DIRECCIÓN MAC ---
        m_mac = cls.MAC_PATTERN.search(text)
        if m_mac:
            result["mac_address"] = m_mac.group(0).upper()
            
        # --- 5. EXTRACCIÓN DE POTENCIA ÓPTICA ---
        m_pwr = cls.POWER_PATTERN.search(text)
        if m_pwr:
            result["optical_power"] = f"{m_pwr.group(1)} dBm"
            
        # --- 6. EXTRACCIÓN DE UBICACIÓN (SLOT / PON / ONU) SI VIENE EN EL CORREO ---
        m_slot = re.search(r'Slot[:\s]*(\d+)', text, re.IGNORECASE)
        m_pon = re.search(r'PON[:\s]*(\d+)', text, re.IGNORECASE)
        m_onu = re.search(r'(?:Ct\.?\s*Onu|Onu(?:\s*ID)?)[:\s]*(\d+)', text, re.IGNORECASE)
        
        if m_slot: result["slot"] = m_slot.group(1)
        if m_pon: result["pon"] = m_pon.group(1)
        if m_onu: result["onu_id"] = m_onu.group(1)
        
        # Buscar formato compacto tipo 3/4 o 3/4/18
        if not result["slot"] or not result["pon"]:
            m_slash = re.search(r'(?:puerto|slot/pon|pon|slot)[:\s]*(\d+)\s*/\s*(\d+)(?:\s*/\s*(\d+))?', text, re.IGNORECASE)
            if not m_slash:
                m_slash = re.search(r'\b(\d{1,2})\s*/\s*(\d{1,2})(?:\s*/\s*(\d{1,3}))?\b', text)
            if m_slash:
                result["slot"] = m_slash.group(1)
                result["pon"] = m_slash.group(2)
                if m_slash.group(3):
                    result["onu_id"] = m_slash.group(3)
                    
        if result["slot"] or result["pon"]:
            parts = []
            if result["slot"]: parts.append(f"Slot {result['slot']}")
            if result["pon"]: parts.append(f"PON {result['pon']}")
            if result["onu_id"]: parts.append(f"Ct.Onu {result['onu_id']}")
            result["slot_pon"] = " / ".join(parts)
            
        # Default a Redes de Acceso y Aprovisionamiento
        result["departamento_codigo"] = "ACCESO_APROV"
        result["departamento_nombre"] = "Redes de Acceso y Aprovisionamiento"
        result["detected_area"] = "Redes de Acceso y Aprovisionamiento"

        # --- 7. CLASIFICACIÓN HEURÍSTICA POR DEPARTAMENTO OFICIAL (feature_control_correos.md) ---
        
        # 0. MODO BRIDGE / IP CERTIFICADA EN ONT (Redes de Acceso y Aprovisionamiento - P4)
        if any(k in lower_text for k in ["bridge", "ip certificada", "ip fija", "wanmac", "router propio", "ip cert"]):
            result["departamento_codigo"] = "ACCESO_APROV"
            result["departamento_nombre"] = "Redes de Acceso y Aprovisionamiento"
            result["detected_area"] = "Redes de Acceso y Aprovisionamiento"
            result["is_bridge"] = True
            result["suggested_task_code"] = "P4-SOP-01"
            result["suggested_task_name"] = "Soporte a Modo Bridge con IP Certificada"
            result["suggested_points"] = 5
            result["matched_keywords"].append("Modo Bridge / IP Certificada")

        # 1. SEGURIDAD
        elif any(k in lower_text for k in ["firewall", "ddos", "ataque", "bloqueo ip", "spoofing", "perimetral", "vpn ipsec", "seguridad perimetral", "puerto bloqueado", "intruso"]):
            result["departamento_codigo"] = "SEGURIDAD"
            result["departamento_nombre"] = "Seguridad"
            result["detected_area"] = "Seguridad"
            result["suggested_task_code"] = "P4-SEG-01"
            result["suggested_task_name"] = "Mitigación y Políticas Perimetrales"
            result["suggested_points"] = 5
            result["is_critical"] = True
            result["matched_keywords"].append("Seguridad / Firewall")

        # 2. CONTROL DE TRÁFICO E INALÁMBRICAS
        elif any(k in lower_text for k in ["microondas", "inalambric", "radioenlace", "saturacion rf", "qos", "shaping", "ancho de banda", "antena", "enlace ptp"]):
            result["departamento_codigo"] = "TRAFICO_INALAMBRICO"
            result["departamento_nombre"] = "Control de Tráfico e Redes Inalámbricas"
            result["detected_area"] = "Control de Tráfico e Redes Inalámbricas"
            result["suggested_task_code"] = "P3-TRAF-01"
            result["suggested_task_name"] = "Ajuste QoS y Balanceo de Tráfico RF"
            result["suggested_points"] = 3
            result["matched_keywords"].append("Tráfico / Inalámbricas")

        # 3. TELEFONÍA
        elif any(k in lower_text for k in ["sip", "voip", "403", "forbidden", "timeout sip", "dialplan", "linea telefonica", "tono", "mos", "jitter"]):
            result["departamento_codigo"] = "TELEFONIA"
            result["departamento_nombre"] = "Telefonía"
            result["detected_area"] = "Telefonía"
            if any(k in lower_text for k in ["mos", "jitter", "calidad de voz", "entrecortado"]):
                result["suggested_task_code"] = "P4-TEL-01"
                result["suggested_task_name"] = "Diagnóstico Degradación MOS y Jitter"
                result["suggested_points"] = 5
            else:
                result["suggested_task_code"] = "P3-TEL-01"
                result["suggested_task_name"] = "Depuración Falla Señalización SIP"
                result["suggested_points"] = 3
            result["matched_keywords"].append("Telefonía / SIP")

        # 4. REDES WAN / CABECERA
        elif any(k in lower_text for k in ["portchannel", "20g", "sfp", "xfp", "mini red", "chasis", "gcob", "hswa", "saturacion uplink", "bgp", "mpls", "peering", "enrutamiento wan"]):
            result["departamento_codigo"] = "REDES_WAN"
            result["departamento_nombre"] = "Redes WAN"
            result["detected_area"] = "Redes WAN"
            if any(k in lower_text for k in ["portchannel", "mini red", "20g", "bgp"]):
                result["suggested_task_code"] = "P5-CAB-01"
                result["suggested_task_name"] = "Habilitación PortChannel 10G -> 20G / Enlace Troncal"
                result["suggested_points"] = 8
                result["is_critical"] = True
            else:
                result["suggested_task_code"] = "P3-CAB-01"
                result["suggested_task_name"] = "Sustitución Módulo SFP en Switch WAN"
                result["suggested_points"] = 3
            result["matched_keywords"].append("Redes WAN / Troncal")

        # 5. GRANDES CLIENTES
        elif any(k in lower_text for k in ["corporativo", "cliente vip", "banca", "simetrico", "dedicado", "circuito privado", "sla empresarial", "enlace dedicado"]):
            result["departamento_codigo"] = "GRANDES_CLIENTES"
            result["departamento_nombre"] = "Grandes Clientes"
            result["detected_area"] = "Grandes Clientes"
            result["suggested_task_code"] = "P4-GC-01"
            result["suggested_task_name"] = "Atención VIP Enlace Corporativo Simétrico"
            result["suggested_points"] = 5
            result["matched_keywords"].append("Grandes Clientes / VIP")

        # 6. REDES DE ACCESO Y APROVISIONAMIENTO (Default FTTH / OLT)
        else:
            result["departamento_codigo"] = "ACCESO_APROV"
            result["departamento_nombre"] = "Redes de Acceso y Aprovisionamiento"
            result["detected_area"] = "Redes de Acceso y Aprovisionamiento"
            
            if any(k in lower_text for k in ["discovery", "whitelist", "demonio", "traspaso", "reemplazo", "desatascar"]):
                result["suggested_task_code"] = "P3-SOP-01"
                result["suggested_task_name"] = "Desatasco Demonio OLT (VLAN / Whitelist)"
                result["suggested_points"] = 3
                result["matched_keywords"].append("Demonio / Whitelist")
            elif any(k in lower_text for k in ["mac roja", "mac en rojo", "discrepancia", "speedtest", "velocidad"]):
                result["suggested_task_code"] = "P2-SOP-02"
                result["suggested_task_name"] = "Resolución Discrepancia MAC (Roja a Verde)"
                result["suggested_points"] = 2
                result["matched_keywords"].append("MAC Roja / Velocidad")
            else:
                result["suggested_task_code"] = "P1-SOP-01"
                result["suggested_task_name"] = "Verificación Estado ONT en OLT"
                result["suggested_points"] = 1
                result["matched_keywords"].append("Aprovisionamiento / Acceso")
            
        return result
