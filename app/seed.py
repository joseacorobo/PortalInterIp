"""
seed.py — Generador Masivo de Datos para Portal de Operaciones IP
=================================================================
Genera:
  - 22 usuarios operativos (Coordinador y Especialistas para cada una de las 5 áreas oficiales + Administradores)
  - Catálogo de tareas P1 a P5 para las 5 áreas técnicas exclusivas
  - 500 tickets históricos (estado RESUELTO) distribuidos en los últimos 30 días
  - 50 tickets activos (PENDIENTE, EN PROGRESO, EN ESPERA) distribuidos en las 5 áreas
"""

try:
    from database import get_db, init_db
except ImportError:
    from app.database import get_db, init_db

import random
import hashlib
from datetime import datetime, timedelta

# ──────────────────────────────────────────────
# CONSTANTES DE DISTRIBUCIÓN
# ──────────────────────────────────────────────
HISTORICAL_COUNT = 500
ACTIVE_COUNT = 50
DAYS_BACK = 30
SEED_RANDOM = 42          # reproducibilidad

# EXACTAMENTE LAS 6 ÁREAS OFICIALES REQUERIDAS
AREAS = [
    "Redes de acceso y aprovisionamiento",
    "Control de Trafico y Redes inalambricas",
    "Redes WAN",
    "Seguridad",
    "Telefonia",
    "Grandes Clientes",
]

ACTIVE_STATUSES = ["PENDIENTE", "EN PROGRESO", "EN ESPERA"]
STATUS_WEIGHTS  = [0.35,       0.50,          0.15]          # probabilidades para activos

COMPLEXITY_WEIGHTS = {"P1": 0.30, "P2": 0.28, "P3": 0.22, "P4": 0.12, "P5": 0.08}

SUBJECTS_TMPL = {
    "Redes de acceso y aprovisionamiento": [
        "ONT en Discovery permanente – Nodo {node}",
        "Abonado {code} sin señal TX/RX – OLT {node}",
        "MAC en ROJO en BD 815 – Cliente {code}",
        "Pool IP agotado – Área {node}",
        "Solicitud de traspaso de puerto PON – Serial {serial}",
        "IP Certificada sin tráfico – modo Bridge – {code}",
        "Discrepancia de MAC address – Abonado {code}",
        "GCOB caída – Recuperación masiva – PON {node}",
    ],
    "Control de Trafico y Redes inalambricas": [
        "Saturación de RF en Radioenlace Microondas – Nodo {node}",
        "Pérdida de paquetes en enlace inalámbrico – {node}",
        "Ajuste de colas QoS y ancho de banda RF – {node}",
        "Interferencia en canal inalámbrico 5GHz – Nodo {node}",
        "Degradación RSSI enlace troncal PTP – {node}",
        "Shaping y balanceo de tráfico anómalo – {node}",
    ],
    "Redes WAN": [
        "Alerta tráfico Uplink Switch Core-{node} al {pct}%",
        "SFP-10G falla en Switch distribución – Puerto {slot}",
        "Limpieza preventiva patch cord – Rack {node}",
        "PortChannel degradado – Troncal {node}",
        "Reemplazo controladora HSWA – Equipo {node}",
        "Caída de sesión BGP / Enlace WAN – Nodo {node}",
        "Telemetría anómala – Puerto 10G – Switch {node}",
    ],
    "Seguridad": [
        "Alerta intento de intrusión IP / Fuerza bruta – Nodo {node}",
        "Aislamiento preventivo de IP de origen malicioso – {node}",
        "Regla de filtrado firewall requerida – IP {node}",
        "Mitigación ataque DDoS perimetral – Core {node}",
        "Tráfico anómalo detectado en puerto WAN – Nodo {node}",
        "Bloqueo preventivo de puertos de gestión abiertos – {node}",
    ],
    "Telefonia": [
        "Falla registro SIP masivo – {node} ONTs afectadas",
        "Error 403 Forbidden / Timeout – Softswitch {node}",
        "Degradación MOS <4.0 y jitter – VLAN Voz – {node}",
        "Enlace troncal SIP caído – Call Server {node}",
        "Credenciales SIP inválidas – Abonado {code}",
        "Eco en línea y retransmisión RTP – {node}",
    ],
    "Grandes Clientes": [
        "Enlace dedicado fibra oscura caído – Cliente Corporativo {code}",
        "Degradación de latencia y jitter en enlace VIP – Sede {node}",
        "BGP Down en router de borde cliente corporativo – {code}",
        "Falla de contingencia / Failover enlace simétrico – {node}",
        "Ajuste de filtros BGP y prefijos IP anunciados – Cliente {code}",
        "Saturación de enlace troncal dedicado 1G – Corporativo {code}",
    ],
}

NODES = ["OLT-CCS-01", "OLT-CCS-02", "OLT-CHAC-01", "OLT-VAL-01", "OLT-BAR-01",
         "OLT-MAR-01", "SW-CORE-A", "SW-DIST-B", "SW-AGR-01", "SBCX-02", "FW-PERIM-01", "RAD-LINK-04"]

SERIALS = [f"FHTT{random.randint(10000000,99999999)}" for _ in range(50)]

EMAIL_DOMAINS = [
    "inter.com.ve", "noc.inter.com.ve", "soporte.inter.com.ve",
    "clientes.inter.com.ve", "gmail.com"
]

RESOLUTION_NOTES = [
    "Ticket resuelto. ONT registrada correctamente en OLT.",
    "Problema corregido. MAC actualizada en BD 815.",
    "Servicio restaurado tras reemplazo de módulo SFP.",
    "Demonio OLT desatascado. Abonado en línea.",
    "SLA cumplido. Cierre por resolución exitosa.",
    "Enlace troncal restablecido. Tráfico normalizado.",
    "Registro SIP activo. Calidad de voz MOS 4.2.",
    "IP certificada asignada. Bridge configurado.",
    "Tarjeta GCOB reemplazada. PONs recuperados.",
    "PortChannel ampliado a 20G. Capacidad OK.",
    "Regla perimetral aplicada y ataque mitigado.",
    "Frecuencia reconfigurada y enlace inalámbrico estabilizado.",
]


def _random_subject(area: str) -> str:
    tmpl = random.choice(SUBJECTS_TMPL[area])
    return tmpl.format(
        node=random.choice(NODES),
        code=f"CLI-{random.randint(100000, 999999)}",
        serial=random.choice(SERIALS),
        slot=f"Slot {random.randint(1,8)}/PON {random.randint(1,16)}",
        pct=random.randint(65, 95),
    )


def _random_mac() -> str:
    return ":".join(f"{random.randint(0,255):02X}" for _ in range(6))


def _random_email() -> str:
    name = random.choice(["soporte", "noc", "operaciones", "incidencias", "coordinacion", "cliente"])
    domain = random.choice(EMAIL_DOMAINS)
    return f"{name}.{random.randint(10,99)}@{domain}"


def _ticket_code(n: int) -> str:
    return f"INC-{40000 + n}"


# ──────────────────────────────────────────────
# FUNCIÓN PRINCIPAL
# ──────────────────────────────────────────────
def seed(skip_init: bool = False):
    random.seed(SEED_RANDOM)

    if not skip_init:
        init_db()

    conn = get_db()
    cur = conn.cursor()

    # ── Limpiar tablas (orden correcto para FK) ──────────────────
    print("[seed] Limpiando tablas previas...")
    cur.execute("DELETE FROM ticket_historial_estados")
    cur.execute("DELETE FROM ticket_attachments")
    cur.execute("DELETE FROM email_replies")
    cur.execute("DELETE FROM audit_logs")
    cur.execute("DELETE FROM task_logs")
    cur.execute("DELETE FROM email_tickets")
    cur.execute("DELETE FROM task_types")
    cur.execute("DELETE FROM users")
    cur.execute("DELETE FROM departamentos")

    # Reset autoincrement sequences
    for tbl in ["users", "departamentos", "task_types", "email_tickets", "task_logs",
                "audit_logs", "ticket_attachments", "email_replies",
                "ticket_historial_estados"]:
        cur.execute(f"DELETE FROM sqlite_sequence WHERE name='{tbl}'")

    # ── 1. EXACTAMENTE LAS 6 ÁREAS EN DEPARTAMENTOS ───────────────
    departamentos = [
        ("ACCESO_APROV",        "Redes de acceso y aprovisionamiento", "Atención OLT, FTTH, aprovisionamiento de módems y puertos GPON", 1),
        ("TRAFICO_INALAMBRICO", "Control de Trafico y Redes inalambricas", "Monitoreo de saturación RF, balanceo y enlaces inalámbricos", 1),
        ("REDES_WAN",           "Redes WAN",                           "Enrutamiento troncal, BGP, MPLS y conectividad interurbana", 1),
        ("SEGURIDAD",           "Seguridad",                           "Políticas perimetrales, firewalls, mitigación de ataques y accesos IP", 1),
        ("TELEFONIA",           "Telefonia",                           "Servidores SIP, gateways de voz, troncales IP y numeración", 1),
        ("GRANDES_CLIENTES",    "Grandes Clientes",                    "Atención técnica especializada a clientes corporativos, enlaces dedicados y cuentas VIP", 1),
    ]
    cur.executemany(
        "INSERT INTO departamentos (codigo, nombre, descripcion, activo) VALUES (?, ?, ?, ?)",
        departamentos
    )
    print(f"[seed] {len(departamentos)} departamentos oficiales insertados.")

    # Obtener IDs de departamentos
    cur.execute("SELECT codigo, id FROM departamentos")
    dep_map = {row[0]: row[1] for row in cur.fetchall()}

    # ── 2. USUARIOS: COORDINADORES Y OPERADORES POR ÁREA ──────────
    default_hash = hashlib.sha256("inter2026".encode()).hexdigest()

    users_data = [
        # Administrador General (Gestión total del sistema para pruebas)
        ("Administrador General", "Todas", "ADMINISTRADOR", "AD", "General", "Activo", "admin@inter.com.ve", default_hash, dep_map["ACCESO_APROV"]),
        
        # 1. Redes de acceso y aprovisionamiento
        ("Adelis Mejia", "Redes de acceso y aprovisionamiento", "COORDINADOR",  "AM", "Mañana", "Activo", "adelis.mejia@inter.com.ve", default_hash, dep_map["ACCESO_APROV"]),
        ("José Corobo",  "Redes de acceso y aprovisionamiento", "ESPECIALISTA", "JC", "Mañana", "Activo", "joseacorobo@gmail.com",     default_hash, dep_map["ACCESO_APROV"]),
        ("David Rodríguez", "Redes de acceso y aprovisionamiento", "ESPECIALISTA", "DR", "Tarde", "Activo", "david.rodriguez@inter.com.ve", default_hash, dep_map["ACCESO_APROV"]),

        # 2. Control de Trafico y Redes inalambricas
        ("Gabriel Torres", "Control de Trafico y Redes inalambricas", "COORDINADOR", "GT", "Mañana", "Activo", "gabriel.torres@inter.com.ve", default_hash, dep_map["TRAFICO_INALAMBRICO"]),
        ("Ricardo Morales", "Control de Trafico y Redes inalambricas", "ESPECIALISTA", "RM", "Mañana", "Activo", "ricardo.morales@inter.com.ve", default_hash, dep_map["TRAFICO_INALAMBRICO"]),

        # 3. Redes WAN
        ("Marcos Peña", "Redes WAN", "COORDINADOR", "MP", "Mañana", "Activo", "marcos.pena@inter.com.ve", default_hash, dep_map["REDES_WAN"]),
        ("Alejandro Silva", "Redes WAN", "ESPECIALISTA", "AS", "Mañana", "Activo", "alejandro.silva@inter.com.ve", default_hash, dep_map["REDES_WAN"]),

        # 4. Seguridad
        ("Valeria Rivas", "Seguridad", "COORDINADOR", "VR", "Mañana", "Activo", "valeria.rivas@inter.com.ve", default_hash, dep_map["SEGURIDAD"]),
        ("Daniel Castillo", "Seguridad", "ESPECIALISTA", "DC", "Mañana", "Activo", "daniel.castillo@inter.com.ve", default_hash, dep_map["SEGURIDAD"]),

        # 5. Telefonia
        ("Fernando Gómez", "Telefonia", "COORDINADOR", "FG", "Mañana", "Activo", "fernando.gomez@inter.com.ve", default_hash, dep_map["TELEFONIA"]),
        ("Mariana Blanco", "Telefonia", "ESPECIALISTA", "MB", "Mañana", "Activo", "mariana.blanco@inter.com.ve", default_hash, dep_map["TELEFONIA"]),

        # 6. Grandes Clientes
        ("Carlos Mendoza", "Grandes Clientes", "COORDINADOR", "CM", "Mañana", "Activo", "carlos.mendoza@inter.com.ve", default_hash, dep_map["GRANDES_CLIENTES"]),
        ("Andrea Paredes", "Grandes Clientes", "ESPECIALISTA", "AP", "Mañana", "Activo", "andrea.paredes@inter.com.ve", default_hash, dep_map["GRANDES_CLIENTES"]),
    ]
    cur.executemany(
        "INSERT INTO users (name, area, role, avatar, shift, status, email, password_hash, departamento_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        users_data
    )
    print(f"[seed] {len(users_data)} usuarios operativos insertados.")

    # ── 3. CATÁLOGO OFICIAL DE TIPOS DE TAREA P1-P5 ──────────────
    task_types = [
        # Redes de acceso y aprovisionamiento
        ("P1-SOP-01", "Verificación Estado ONT (Discovery/Whitelist)",   "Redes de acceso y aprovisionamiento",  1,  10, "Consulta de señal y estado L2"),
        ("P1-SOP-02", "Chequeo Potencia TX/RX en OLT",                   "Redes de acceso y aprovisionamiento",  1,  10, "Validación de atenuación óptica"),
        ("P1-SOP-03", "Lectura Estado ONT por CLI",                       "Redes de acceso y aprovisionamiento",  1,  12, "Comandos básicos de diagnóstico"),
        ("P2-SOP-01", "Prueba Oficial de Velocidad por CLI",              "Redes de acceso y aprovisionamiento",  2,  20, "Test Speedtest puerto GE de ONT"),
        ("P2-SOP-02", "Resolución Discrepancia MAC (Roja a Verde)",       "Redes de acceso y aprovisionamiento",  2,  25, "Corrección de MAC en BD 815"),
        ("P2-SOP-03", "Reenvío de Perfil GPON a ONT",                     "Redes de acceso y aprovisionamiento",  2,  18, "Push de perfil desde OLT"),
        ("P3-SOP-01", "Desatasco Demonio OLT (VLAN / Whitelist)",         "Redes de acceso y aprovisionamiento",  3,  35, "Forzado de registro de abonado"),
        ("P3-SOP-02", "Traspaso de Puerto PON / Reemplazo Serial",        "Redes de acceso y aprovisionamiento",  3,  40, "Migración de cliente FiberHome/Huawei"),
        ("P3-SOP-03", "Aprovisionamiento desde Cero en OLT",              "Redes de acceso y aprovisionamiento",  3,  45, "Alta nueva de abonado FTTH"),
        ("P4-SOP-01", "Soporte a Modo Bridge con IP Certificada",         "Redes de acceso y aprovisionamiento",  5,  60, "Configuración estricta sin refresh"),
        ("P4-SOP-02", "Remediación Bloqueo BD 815 / Pool IP Agotado",     "Redes de acceso y aprovisionamiento",  5,  55, "Desbloqueo de cola de aprovisionamiento"),
        ("P5-SOP-01", "Atención y Recuperación Falla Tarjeta GCOB",       "Redes de acceso y aprovisionamiento",  8, 120, "Restablecimiento masivo de PONs"),

        # Control de Trafico y Redes inalambricas
        ("P1-TRAF-01", "Monitoreo Niveles RF y RSSI en Radioenlace",      "Control de Trafico y Redes inalambricas", 1, 15, "Inspección de enlace inalámbrico"),
        ("P2-TRAF-01", "Diagnóstico de Pérdida de Paquetes Wireless",     "Control de Trafico y Redes inalambricas", 2, 25, "Análisis de interferencia RF"),
        ("P3-TRAF-01", "Ajuste QoS y Balanceo de Tráfico RF",             "Control de Trafico y Redes inalambricas", 3, 45, "Reconfiguración de colas de tráfico"),
        ("P4-TRAF-01", "Reconfiguración Shaping y Ancho de Banda Microondas", "Control de Trafico y Redes inalambricas", 5, 60, "Optimización de tasa de transmisión"),
        ("P5-TRAF-01", "Recuperación de Caída de Enlace Troncal Microondas", "Control de Trafico y Redes inalambricas", 8, 120, "Restablecimiento de enlace PTP"),

        # Redes WAN
        ("P1-CAB-01", "Lectura Telemetría Puerto Switch 10G",             "Redes WAN", 1,  15, "Revisión de consumo de tráfico"),
        ("P1-CAB-02", "Verificación Uptime y Alarmas NMS",                "Redes WAN", 1,  12, "Consulta básica de monitoreo"),
        ("P2-CAB-01", "Inspección y Limpieza de Patch Cord Óptico",       "Redes WAN", 2,  30, "Mantenimiento físico en rack"),
        ("P2-CAB-02", "Análisis de Errores FCS en Puerto Troncal",        "Redes WAN", 2,  25, "Revisión de errores de capa 2"),
        ("P3-CAB-01", "Sustitución Módulo SFP-10G-SR en Switch",          "Redes WAN", 3,  45, "Reemplazo de transceptor con falla"),
        ("P3-CAB-02", "Cambio de VLAN en Puerto de Distribución",         "Redes WAN", 3,  35, "Reconfiguración de segmentación"),
        ("P4-CAB-01", "Reemplazo Tarjeta Controladora HSWA",              "Redes WAN", 5,  75, "Mantenimiento crítico de controladora"),
        ("P4-CAB-02", "Activación OSPF/BGP en Nuevo Enlace WAN",          "Redes WAN", 5,  80, "Routing dinámico entre nodos"),
        ("P5-CAB-01", "Habilitación PortChannel 10G→20G en OLT/SW",       "Redes WAN", 8, 120, "Ampliación de capacidad troncal"),
        ("P5-CAB-02", "Armado y Certificación de Mini Red para OLT",      "Redes WAN", 8, 150, "Puesta en marcha de nuevo nodo"),

        # Seguridad
        ("P1-SEG-01", "Verificación Estado de Puerto y Aislamiento IP",   "Seguridad", 1,  10, "Consulta de tráfico anómalo"),
        ("P2-SEG-01", "Validación Reglas de Filtrado IP / Whitelist",     "Seguridad", 2,  20, "Comprobación de acceso perimetral"),
        ("P3-SEG-01", "Bloqueo Preventivo de IP Origen por Intentos Fallidos", "Seguridad", 3, 35, "Aislamiento de amenaza perimetral"),
        ("P4-SEG-01", "Mitigación y Políticas Perimetrales Firewall / DDoS", "Seguridad", 5, 60, "Mitigación de ataque y políticas"),
        ("P5-SEG-01", "Contención de Incidente Crítico de Seguridad Core", "Seguridad", 8, 120, "Respuesta a incidente mayor"),

        # Telefonia
        ("P1-TEL-01", "Consulta Estado Registro SIP en Softswitch",       "Telefonia", 1,  10, "Validación de registro activo"),
        ("P1-TEL-02", "Verificación Troncal SIP en Dashboard",            "Telefonia", 1,  12, "Estado básico del call server"),
        ("P2-TEL-01", "Corrección Básica de Credenciales SIP",            "Telefonia", 2,  20, "Reenvío de auth a la ONT"),
        ("P2-TEL-02", "Actualización Perfil de Voz en OLT",               "Telefonia", 2,  22, "Re-push de parámetros VoIP"),
        ("P3-TEL-01", "Depuración Falla Señalización SIP / Timeout",      "Telefonia", 3,  35, "Análisis de traza SIP Wireshark"),
        ("P3-TEL-02", "Diagnóstico Eco en Línea / RTCP Análisis",         "Telefonia", 3,  40, "Calidad de audio VoIP"),
        ("P4-TEL-01", "Diagnóstico Degradación MOS (<4.0) y Jitter",      "Telefonia", 5,  60, "Análisis de QoS en VLAN de voz"),
        ("P4-TEL-02", "Habilitación Codec G.722 en Perfil de Voz",        "Telefonia", 5,  55, "Configuración avanzada de codecs"),
        ("P5-TEL-01", "Restauración de Enlace Troncal SIP Call Server",   "Telefonia", 8, 120, "Falla masiva de telefonía"),

        # Grandes Clientes
        ("P1-GC-01", "Monitoreo y Diagnóstico Enlace Corporativo Dedicado", "Grandes Clientes", 1, 15, "Consulta de disponibilidad de enlace corporativo"),
        ("P2-GC-01", "Verificación Rendimiento y Latencia de Enlace VIP", "Grandes Clientes", 2, 25, "Validación de parámetros y estabilidad corporativa"),
        ("P3-GC-01", "Reconfiguración BGP / Prefijos IP Grandes Clientes", "Grandes Clientes", 3, 40, "Ajuste de enrutamiento y filtros de prefijos"),
        ("P4-GC-01", "Atención VIP Enlace Corporativo Simétrico", "Grandes Clientes", 5, 60, "Soporte de alta prioridad a circuito privado"),
        ("P5-GC-01", "Restauración Crítica Red WAN / Failover Corporativo", "Grandes Clientes", 8, 120, "Recuperación de contingencia en enlace dedicado"),
    ]
    cur.executemany(
        "INSERT INTO task_types (code, name, area, points, sla_minutes, description) VALUES (?, ?, ?, ?, ?, ?)",
        task_types
    )
    print(f"[seed] {len(task_types)} tipos de tarea insertados.")

    # ── Mapeo de Tareas y Operadores por Área ────────────────────
    cur.execute("SELECT id, name, area, role FROM users WHERE role = 'ESPECIALISTA'")
    op_rows = cur.fetchall()

    ops_by_area = {a: [] for a in AREAS}
    for u in op_rows:
        u_area = u[2]
        if u_area in ops_by_area:
            ops_by_area[u_area].append((u[0], u[1], u[2]))

    cur.execute("SELECT id, code, name, area, points, sla_minutes FROM task_types")
    task_rows = cur.fetchall()

    task_by_area = {a: [] for a in AREAS}
    for t in task_rows:
        t_area = t[3]
        if t_area in task_by_area:
            task_by_area[t_area].append(t)

    dep_by_area = {
        "Redes de acceso y aprovisionamiento": dep_map["ACCESO_APROV"],
        "Control de Trafico y Redes inalambricas": dep_map["TRAFICO_INALAMBRICO"],
        "Redes WAN": dep_map["REDES_WAN"],
        "Seguridad": dep_map["SEGURIDAD"],
        "Telefonia": dep_map["TELEFONIA"],
        "Grandes Clientes": dep_map["GRANDES_CLIENTES"],
    }

    # ── 4. TICKETS HISTÓRICOS (500 × RESUELTO) ───────────────────
    print(f"[seed] Generando {HISTORICAL_COUNT} tickets históricos...")
    now = datetime.now()
    historical_tickets = []

    for i in range(HISTORICAL_COUNT):
        area = random.choice(AREAS)
        task = random.choice(task_by_area[area])
        t_id, t_code, t_name, t_area, t_pts, t_sla = task

        operator = random.choice(ops_by_area[area])
        op_id, op_name, op_area = operator

        days_ago_f = random.uniform(0.5, DAYS_BACK)
        created_at = now - timedelta(days=days_ago_f)

        wait_minutes   = max(0, int(random.gauss(5, 3))) if t_pts >= 3 else 0
        actual_duration = max(5, int(random.gauss(t_sla, t_sla * 0.25)))
        net_duration   = max(5, actual_duration - wait_minutes)

        inicio_offset = random.randint(2, 30)
        fecha_inicio  = created_at + timedelta(minutes=inicio_offset)
        fecha_cierre  = fecha_inicio + timedelta(minutes=actual_duration)

        subject  = _random_subject(area)
        body     = f"Ticket {_ticket_code(i)} - {subject}. Resuelto por {op_name}. Tiempo: {actual_duration} min."
        mac      = _random_mac()
        node     = random.choice(NODES)
        serial   = random.choice(SERIALS)
        slot_pon = f"Slot {random.randint(1,8)}/PON {random.randint(1,16)}/Onu {random.randint(1,32)}"
        sub_code = f"CLI-{random.randint(100000,999999)}"

        ticket_code = _ticket_code(i)

        historical_tickets.append((
            ticket_code,
            _random_email(),
            subject,
            body,
            area,
            sub_code,
            serial,
            node,
            slot_pon,
            mac,
            t_id,
            "RESUELTO",
            "Bandeja",
            op_id,
            created_at.strftime("%Y-%m-%d %H:%M:%S"),
            None,
            0,
            fecha_cierre.strftime("%Y-%m-%d %H:%M:%S"),
            created_at.strftime("%Y-%m-%d %H:%M:%S"),
            f"MSG-{random.randint(100000,999999)}@inter.com.ve",
            "seed",
            "operaciones@inter.com.ve",
            dep_by_area[area],
            op_id,
            created_at.strftime("%Y-%m-%d %H:%M:%S"),
            fecha_inicio.strftime("%Y-%m-%d %H:%M:%S"),
            fecha_cierre.strftime("%Y-%m-%d %H:%M:%S"),
            actual_duration,
            wait_minutes,
        ))

    cur.executemany("""
        INSERT INTO email_tickets (
            ticket_code, sender_email, subject, full_body, area,
            subscriber_code, serial_pon, node_name, slot_pon, mac_address,
            suggested_task_type_id, status, folder,
            claimed_by_user_id, claimed_at, paused_at, total_paused_seconds,
            completed_at, created_at, message_id, source, recipient_email,
            departamento_id, operador_id,
            fecha_creacion, fecha_inicio_atencion, fecha_cierre,
            duracion_atencion_minutos, tiempo_espera_minutos
        ) VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
        )
    """, historical_tickets)
    print(f"[seed] {HISTORICAL_COUNT} tickets históricos insertados.")

    # ── 5. TICKETS ACTIVOS: GARANTIZAR PENDIENTES EN CADA ÁREA ──
    print(f"[seed] Generando {ACTIVE_COUNT} tickets activos distribuidos en las 5 áreas...")
    active_tickets = []
    ticket_num = HISTORICAL_COUNT

    # A. Primero: Al menos 3 tickets en estado 'PENDIENTE' para CADA UNA de las 5 áreas
    for area in AREAS:
        for p_idx in range(3):
            task = random.choice(task_by_area[area])
            t_id, t_code, t_name, t_area, t_pts, t_sla = task
            minutes_ago = random.randint(10, 180)
            created_at = now - timedelta(minutes=minutes_ago)
            ticket_code = _ticket_code(ticket_num)
            ticket_num += 1

            subject = _random_subject(area)
            body = f"Ticket PENDIENTE para coordinación de {area}: {subject}. Esperando asignación técnica."

            active_tickets.append((
                ticket_code,
                _random_email(),
                subject,
                body,
                area,
                f"CLI-{random.randint(100000,999999)}",
                random.choice(SERIALS),
                random.choice(NODES),
                f"Slot {random.randint(1,8)}/PON {random.randint(1,16)}",
                _random_mac(),
                t_id,
                "PENDIENTE",
                "INBOX",
                None,           # claimed_by_user_id (Sin asignar)
                None,           # claimed_at
                None,           # paused_at
                0,              # total_paused_seconds
                None,           # completed_at
                created_at.strftime("%Y-%m-%d %H:%M:%S"),
                f"MSG-{random.randint(100000,999999)}@inter.com.ve",
                "seed",
                "operaciones@inter.com.ve",
                dep_by_area[area],
                None,           # operador_id (Sin asignar)
                created_at.strftime("%Y-%m-%d %H:%M:%S"),
                None,           # fecha_inicio_atencion
                None,           # fecha_cierre
                None,           # duracion_atencion_minutos
                0,              # tiempo_espera_minutos
            ))

    # B. Resto de tickets activos: EN PROGRESO / EN ESPERA con operadores
    remaining = ACTIVE_COUNT - len(active_tickets)
    for j in range(max(10, remaining)):
        area = random.choice(AREAS)
        task = random.choice(task_by_area[area])
        t_id, t_code, t_name, t_area, t_pts, t_sla = task
        status = random.choice(["EN PROGRESO", "EN PROGRESO", "EN ESPERA"])

        operator = random.choice(ops_by_area[area])
        op_id, op_name, _ = operator

        minutes_ago = random.randint(5, 120)
        created_at  = now - timedelta(minutes=minutes_ago)
        claimed_at  = (created_at + timedelta(minutes=random.randint(1, 10))).strftime("%Y-%m-%d %H:%M:%S")

        subject  = _random_subject(area)
        body     = f"Ticket activo {_ticket_code(ticket_num)} - {subject}. Atendido por {op_name}."
        ticket_code = _ticket_code(ticket_num)
        ticket_num += 1

        active_tickets.append((
            ticket_code,
            _random_email(),
            subject,
            body,
            area,
            f"CLI-{random.randint(100000,999999)}",
            random.choice(SERIALS),
            random.choice(NODES),
            f"Slot {random.randint(1,8)}/PON {random.randint(1,16)}",
            _random_mac(),
            t_id,
            status,
            "INBOX",
            op_id,
            claimed_at,
            None,
            0,
            None,
            created_at.strftime("%Y-%m-%d %H:%M:%S"),
            f"MSG-{random.randint(100000,999999)}@inter.com.ve",
            "seed",
            "operaciones@inter.com.ve",
            dep_by_area[area],
            op_id,
            created_at.strftime("%Y-%m-%d %H:%M:%S"),
            claimed_at,
            None,
            None,
            0,
        ))

    cur.executemany("""
        INSERT INTO email_tickets (
            ticket_code, sender_email, subject, full_body, area,
            subscriber_code, serial_pon, node_name, slot_pon, mac_address,
            suggested_task_type_id, status, folder,
            claimed_by_user_id, claimed_at, paused_at, total_paused_seconds,
            completed_at, created_at, message_id, source, recipient_email,
            departamento_id, operador_id,
            fecha_creacion, fecha_inicio_atencion, fecha_cierre,
            duracion_atencion_minutos, tiempo_espera_minutos
        ) VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
        )
    """, active_tickets)
    print(f"[seed] {len(active_tickets)} tickets activos insertados.")

    # ── 6. TASK_LOGS HISTÓRICOS ───────────────────────────────────
    print("[seed] Generando task_logs históricos...")
    cur.execute("""
        SELECT id, ticket_code, claimed_by_user_id, suggested_task_type_id,
               area, duracion_atencion_minutos, tiempo_espera_minutos, created_at
        FROM email_tickets
        WHERE status = 'RESUELTO'
    """)
    resolved = cur.fetchall()

    logs = []
    for row in resolved:
        tid, tcode, uid, ttid, area, dur, wait, cat = row
        if not uid or not ttid:
            continue
        cur.execute("SELECT points FROM task_types WHERE id=?", (ttid,))
        r2 = cur.fetchone()
        pts = r2[0] if r2 else 1
        dur  = dur  or 10
        wait = wait or 0
        net  = max(5, dur - wait)
        logs.append((tcode, uid, ttid, f"Resuelto: {tcode}", pts, dur, wait, net, area, cat))

    cur.executemany("""
        INSERT INTO task_logs (ticket_code, user_id, task_type_id, description,
                               points, duration_minutes, wait_minutes, net_duration,
                               area, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, logs)
    print(f"[seed] {len(logs)} task_logs insertados.")

    conn.commit()
    conn.close()

    print("\n[OK] Seed masivo completado exitosamente para las 6 AREAS OFICIALES:")
    for a in AREAS:
        print(f"   - Area: {a}")
    print(f"   - {len(users_data)} usuarios operativos (Coordinadores + Especialistas)")
    print(f"   - {len(task_types)} tipos de tarea (P1-P5)")
    print(f"   - {HISTORICAL_COUNT} tickets historicos")
    print(f"   - {len(active_tickets)} tickets activos")


if __name__ == "__main__":
    seed()
