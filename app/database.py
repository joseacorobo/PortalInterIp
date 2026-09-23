import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ip_ops.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
    except Exception:
        pass
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Catálogo Oficial de Departamentos / Áreas IP (feature_control_correos.md)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS departamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        activo INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Semilla oficial de departamentos técnicos oficiales
    deptos_oficiales = [
        ('ACCESO_APROV', 'Redes de acceso y aprovisionamiento', 'Atención OLT, FTTH, aprovisionamiento de módems y puertos GPON', 1),
        ('TRAFICO_INALAMBRICO', 'Control de Trafico y Redes inalambricas', 'Monitoreo de saturación RF, balanceo y enlaces inalámbricos', 1),
        ('REDES_WAN', 'Redes WAN', 'Enrutamiento troncal, BGP, MPLS y conectividad interurbana', 1),
        ('SEGURIDAD', 'Seguridad', 'Políticas perimetrales, firewalls, mitigación de ataques y accesos IP', 1),
        ('TELEFONIA', 'Telefonia', 'Servidores SIP, gateways de voz, troncales IP y numeración', 1),
        ('GRANDES_CLIENTES', 'Grandes Clientes', 'Atención técnica especializada a clientes corporativos, enlaces dedicados y cuentas VIP', 1)
    ]
    cursor.execute("UPDATE departamentos SET codigo = 'GRANDES_CLIENTES', nombre = 'Grandes Clientes' WHERE codigo = 'GRANDES_CUENTAS'")
    cursor.executemany("""
    INSERT OR IGNORE INTO departamentos (codigo, nombre, descripcion, activo)
    VALUES (?, ?, ?, ?)
    """, deptos_oficiales)
    for code, nom, desc, act in deptos_oficiales:
        cursor.execute("UPDATE departamentos SET nombre = ?, descripcion = ?, activo = ? WHERE codigo = ?", (nom, desc, act, code))
    cursor.execute("DELETE FROM departamentos WHERE codigo NOT IN ('ACCESO_APROV', 'TRAFICO_INALAMBRICO', 'REDES_WAN', 'SEGURIDAD', 'TELEFONIA', 'GRANDES_CLIENTES')")

    # 2. Usuarios y Roles (Soporta Autenticación RBAC y Operadores por Departamento)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        departamento_id INTEGER,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        area TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ESPECIALISTA', -- ADMINISTRADOR, COORDINADOR, ESPECIALISTA
        avatar TEXT,
        shift TEXT DEFAULT 'Mañana',
        status TEXT DEFAULT 'Activo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (departamento_id) REFERENCES departamentos(id)
    )
    """)
    
    # Migración segura de columnas en users
    cursor.execute("PRAGMA table_info(users)")
    existing_user_cols = [c[1] for c in cursor.fetchall()]
    if "email" not in existing_user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT")
    if "password_hash" not in existing_user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
    if "created_at" not in existing_user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN created_at TIMESTAMP")
    if "departamento_id" not in existing_user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN departamento_id INTEGER REFERENCES departamentos(id)")

    # Vincular usuarios a su departamento oficial
    cursor.execute("""
    UPDATE users SET departamento_id = (
        CASE 
            WHEN area IN ('Soporte', 'Acceso', 'Redes de Acceso', 'Redes de acceso y aprovisionamiento') THEN (SELECT id FROM departamentos WHERE codigo = 'ACCESO_APROV')
            WHEN area IN ('Cabecera', 'Redes WAN') THEN (SELECT id FROM departamentos WHERE codigo = 'REDES_WAN')
            WHEN area IN ('Telefonía', 'Telefonia') THEN (SELECT id FROM departamentos WHERE codigo = 'TELEFONIA')
            WHEN area LIKE '%Seguridad%' THEN (SELECT id FROM departamentos WHERE codigo = 'SEGURIDAD')
            WHEN area LIKE '%Tráfico%' OR area LIKE '%Trafico%' THEN (SELECT id FROM departamentos WHERE codigo = 'TRAFICO_INALAMBRICO')
            WHEN area LIKE '%Grandes%' OR area LIKE '%Corporativo%' THEN (SELECT id FROM departamentos WHERE codigo = 'GRANDES_CLIENTES')
            ELSE (SELECT id FROM departamentos WHERE codigo = 'ACCESO_APROV')
        END
    ) WHERE departamento_id IS NULL OR departamento_id NOT IN (SELECT id FROM departamentos)
    """)
    
    # Catálogo de Tareas P1 a P5
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS task_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        area TEXT NOT NULL,
        points INTEGER NOT NULL,
        sla_minutes INTEGER NOT NULL,
        description TEXT
    )
    """)

    # Catálogo Oficial de Tareas P1 a P5 para las 6 Áreas Técnicas
    catalogo_tareas = [
        # Redes de acceso y aprovisionamiento
        ("P1-SOP-01", "Verificación Estado ONT (Discovery/Whitelist)", "Redes de acceso y aprovisionamiento", 1, 10, "Consulta de señal y estado L2"),
        ("P1-SOP-02", "Chequeo Potencia TX/RX en OLT", "Redes de acceso y aprovisionamiento", 1, 10, "Validación de atenuación óptica"),
        ("P2-SOP-01", "Prueba Oficial de Velocidad por CLI", "Redes de acceso y aprovisionamiento", 2, 20, "Test Speedtest puerto GE de ONT"),
        ("P2-SOP-02", "Resolución Discrepancia MAC (Roja a Verde)", "Redes de acceso y aprovisionamiento", 2, 25, "Corrección de MAC en BD 815"),
        ("P3-SOP-01", "Desatasco Demonio OLT (VLAN / Whitelist)", "Redes de acceso y aprovisionamiento", 3, 35, "Forzado de registro de abonado"),
        ("P3-SOP-02", "Traspaso de Puerto PON / Reemplazo Serial", "Redes de acceso y aprovisionamiento", 3, 40, "Migración de cliente FiberHome/Huawei"),
        ("P4-SOP-01", "Soporte a Modo Bridge con IP Certificada", "Redes de acceso y aprovisionamiento", 5, 60, "Configuración estricta sin refresh"),
        ("P4-SOP-02", "Remediación Bloqueo BD 815 / Pool IP Agotado", "Redes de acceso y aprovisionamiento", 5, 55, "Desbloqueo de cola de aprovisionamiento"),
        ("P5-SOP-01", "Atención y Recuperación Falla Tarjeta GCOB", "Redes de acceso y aprovisionamiento", 8, 120, "Restablecimiento masivo de PONs"),
        
        # Redes WAN
        ("P1-CAB-01", "Lectura Telemetría Puerto Switch 10G", "Redes WAN", 1, 15, "Revisión de consumo de tráfico"),
        ("P2-CAB-01", "Inspección y Limpieza de Patch Cord Óptico", "Redes WAN", 2, 30, "Mantenimiento físico en rack"),
        ("P3-CAB-01", "Sustitución Módulo SFP en Switch WAN", "Redes WAN", 3, 45, "Reemplazo de transceptor con falla"),
        ("P4-CAB-01", "Reemplazo Tarjeta Controladora HSWA", "Redes WAN", 5, 75, "Mantenimiento crítico de controladora"),
        ("P5-CAB-01", "Habilitación PortChannel 10G -> 20G / Enlace Troncal", "Redes WAN", 8, 120, "Ampliación de capacidad troncal"),
        ("P5-CAB-02", "Armado y Certificación de Mini Red para OLT", "Redes WAN", 8, 150, "Puesta en marcha de nuevo nodo"),
        
        # Telefonia
        ("P1-TEL-01", "Consulta Estado Registro SIP en Softswitch", "Telefonia", 1, 10, "Validación de registro activo"),
        ("P2-TEL-01", "Corrección Básica de Credenciales SIP", "Telefonia", 2, 20, "Reenvío de auth a la ONT"),
        ("P3-TEL-01", "Depuración Falla Señalización SIP / Timeout", "Telefonia", 3, 35, "Análisis de traza SIP Wireshark"),
        ("P4-TEL-01", "Diagnóstico Degradación MOS (<4.0) y Jitter", "Telefonia", 5, 60, "Análisis de QoS en VLAN de voz"),
        ("P5-TEL-01", "Restauración de Enlace Troncal SIP Call Server", "Telefonia", 8, 120, "Falla masiva de telefonía"),
        
        # Seguridad
        ("P1-SEG-01", "Verificación Estado de Puerto y Aislamiento IP", "Seguridad", 1, 10, "Consulta de tráfico anómalo"),
        ("P2-SEG-01", "Validación Reglas de Filtrado IP / Whitelist", "Seguridad", 2, 20, "Comprobación de acceso perimetral"),
        ("P3-SEG-01", "Bloqueo Preventivo de IP Origen por Intentos Fallidos", "Seguridad", 3, 35, "Aislamiento de amenaza perimetral"),
        ("P4-SEG-01", "Mitigación y Políticas Perimetrales Firewall / DDoS", "Seguridad", 5, 60, "Mitigación de ataque y políticas"),
        ("P5-SEG-01", "Contención de Incidente Crítico de Seguridad Core", "Seguridad", 8, 120, "Respuesta a incidente mayor"),
        
        # Control de Trafico y Redes inalambricas
        ("P1-TRAF-01", "Monitoreo Niveles RF y RSSI en Radioenlace", "Control de Trafico y Redes inalambricas", 1, 15, "Inspección de enlace inalámbrico"),
        ("P2-TRAF-01", "Diagnóstico de Pérdida de Paquetes Wireless", "Control de Trafico y Redes inalambricas", 2, 25, "Análisis de interferencia RF"),
        ("P3-TRAF-01", "Ajuste QoS y Balanceo de Tráfico RF", "Control de Trafico y Redes inalambricas", 3, 45, "Reconfiguración de colas de tráfico"),
        ("P4-TRAF-01", "Reconfiguración Shaping y Ancho de Banda Microondas", "Control de Trafico y Redes inalambricas", 5, 60, "Optimización de tasa de transmisión"),
        ("P5-TRAF-01", "Recuperación de Caída de Enlace Troncal Microondas", "Control de Trafico y Redes inalambricas", 8, 120, "Restablecimiento de enlace PTP"),

        # Grandes Clientes
        ("P1-GC-01", "Monitoreo y Diagnóstico Enlace Corporativo Dedicado", "Grandes Clientes", 1, 15, "Consulta de disponibilidad de enlace corporativo"),
        ("P2-GC-01", "Verificación Rendimiento y Latencia de Enlace VIP", "Grandes Clientes", 2, 25, "Validación de parámetros y estabilidad corporativa"),
        ("P3-GC-01", "Reconfiguración BGP / Prefijos IP Grandes Clientes", "Grandes Clientes", 3, 40, "Ajuste de enrutamiento y filtros de prefijos"),
        ("P4-GC-01", "Atención VIP Enlace Corporativo Simétrico", "Grandes Clientes", 5, 60, "Soporte de alta prioridad a circuito privado"),
        ("P5-GC-01", "Restauración Crítica Red WAN / Failover Corporativo", "Grandes Clientes", 8, 120, "Recuperación de contingencia en enlace dedicado")
    ]
    cursor.executemany("""
    INSERT OR IGNORE INTO task_types (code, name, area, points, sla_minutes, description)
    VALUES (?, ?, ?, ?, ?, ?)
    """, catalogo_tareas)
    for code, nom, area_t, pts, sla_m, desc in catalogo_tareas:
        cursor.execute("UPDATE task_types SET name = ?, area = ?, points = ?, sla_minutes = ?, description = ? WHERE code = ?", (nom, area_t, pts, sla_m, desc, code))
    
    # Tickets de Correo con Parámetros Técnicos Extraídos y Tiempos de Cronómetro
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS email_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_code TEXT UNIQUE NOT NULL,
        sender_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        full_body TEXT NOT NULL,
        area TEXT NOT NULL,
        subscriber_code TEXT,
        serial_pon TEXT,
        node_name TEXT,
        slot_pon TEXT,
        mac_address TEXT,
        suggested_task_type_id INTEGER,
        status TEXT DEFAULT 'PENDIENTE', -- PENDIENTE, EN PROGRESO, EN ESPERA, COMPLETADO
        folder TEXT DEFAULT 'INBOX',
        claimed_by_user_id INTEGER,
        claimed_at TIMESTAMP,
        paused_at TIMESTAMP,
        total_paused_seconds INTEGER DEFAULT 0,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (claimed_by_user_id) REFERENCES users(id),
        FOREIGN KEY (suggested_task_type_id) REFERENCES task_types(id)
    )
    """)
    
    # Registro Histórico de Tareas (Duración 100% calculada por el sistema)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS task_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_code TEXT,
        user_id INTEGER NOT NULL,
        task_type_id INTEGER NOT NULL,
        description TEXT,
        points INTEGER NOT NULL,
        duration_minutes INTEGER NOT NULL,
        wait_minutes INTEGER DEFAULT 0,
        net_duration INTEGER NOT NULL,
        area TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (task_type_id) REFERENCES task_types(id)
    )
    """)
    
    
    # Registro de Auditoría Forense y Trazabilidad en Tiempo Real
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        area TEXT NOT NULL,
        action TEXT NOT NULL, -- INICIO_SESION, CIERRE_SESION, CAMBIO_PERFIL, TOMA_TICKET, PAUSA_TICKET, REANUDACION_TICKET, CIERRE_TICKET, INGESTA_CORREO, CONFIG_IMAP
        entity_type TEXT NOT NULL, -- AUTH, TICKET, MAIL_WORKER, SISTEMA
        entity_id TEXT,
        details TEXT,
        ip_address TEXT DEFAULT '127.0.0.1',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)")
    
    # Migración de columnas para audit_logs
    cursor.execute("PRAGMA table_info(audit_logs)")
    audit_cols = [col[1] for col in cursor.fetchall()]
    if "user_area" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN user_area TEXT")
    if "area" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN area TEXT")
    if "target_type" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN target_type TEXT")
    if "entity_type" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN entity_type TEXT")
    if "target_id" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN target_id TEXT")
    if "entity_id" not in audit_cols:
        cursor.execute("ALTER TABLE audit_logs ADD COLUMN entity_id TEXT")
    
    # Migración de columnas para el Worker de Correo y Helpdesk por Tickets
    cursor.execute("PRAGMA table_info(email_tickets)")
    columns = [col[1] for col in cursor.fetchall()]
    if "message_id" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN message_id TEXT")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tickets_msgid ON email_tickets(message_id)")
    if "source" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN source TEXT DEFAULT 'MANUAL'")
    if "recipient_email" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN recipient_email TEXT")
    if "html_body" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN html_body TEXT")
    if "folder" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN folder TEXT DEFAULT 'INBOX'")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_tickets_folder ON email_tickets(folder)")
    if "departamento_id" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN departamento_id INTEGER REFERENCES departamentos(id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_tickets_depto ON email_tickets(departamento_id)")
    if "operador_id" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN operador_id INTEGER REFERENCES users(id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_tickets_operador ON email_tickets(operador_id)")
    if "fecha_creacion" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN fecha_creacion TIMESTAMP")
    if "fecha_inicio_atencion" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN fecha_inicio_atencion TIMESTAMP")
    if "fecha_cierre" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN fecha_cierre TIMESTAMP")
    if "duracion_atencion_minutos" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN duracion_atencion_minutos INTEGER")
    if "tiempo_espera_minutos" not in columns:
        cursor.execute("ALTER TABLE email_tickets ADD COLUMN tiempo_espera_minutos INTEGER")

    # Sincronizar datos históricos de tickets con el nuevo esquema
    cursor.execute("""
    UPDATE email_tickets SET 
        departamento_id = COALESCE(departamento_id, (
            CASE 
                WHEN area IN ('Soporte', 'Acceso', 'Redes de Acceso', 'Redes de acceso y aprovisionamiento') THEN (SELECT id FROM departamentos WHERE codigo = 'ACCESO_APROV')
                WHEN area IN ('Cabecera', 'Redes WAN') THEN (SELECT id FROM departamentos WHERE codigo = 'REDES_WAN')
                WHEN area IN ('Telefonía', 'Telefonia') THEN (SELECT id FROM departamentos WHERE codigo = 'TELEFONIA')
                WHEN area LIKE '%Seguridad%' THEN (SELECT id FROM departamentos WHERE codigo = 'SEGURIDAD')
                WHEN area LIKE '%Tráfico%' OR area LIKE '%Trafico%' THEN (SELECT id FROM departamentos WHERE codigo = 'TRAFICO_INALAMBRICO')
                WHEN area LIKE '%Grandes%' OR area LIKE '%Corporativo%' THEN (SELECT id FROM departamentos WHERE codigo = 'GRANDES_CLIENTES')
                ELSE (SELECT id FROM departamentos WHERE codigo = 'ACCESO_APROV')
            END
        )),
        operador_id = COALESCE(operador_id, claimed_by_user_id),
        fecha_creacion = COALESCE(fecha_creacion, created_at),
        fecha_inicio_atencion = COALESCE(fecha_inicio_atencion, claimed_at),
        fecha_cierre = COALESCE(fecha_cierre, completed_at)
    """)

    # Tabla de Historial de Transiciones y Auditoría de Estados de Tickets
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ticket_historial_estados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        operador_id INTEGER,
        estado_anterior TEXT NOT NULL,
        estado_nuevo TEXT NOT NULL,
        nota_cambio TEXT,
        fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES email_tickets(id),
        FOREIGN KEY (operador_id) REFERENCES users(id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_historial_ticket ON ticket_historial_estados(ticket_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_historial_operador ON ticket_historial_estados(operador_id)")

    # Tabla de Adjuntos, Membretes e Imágenes Inline
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ticket_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_id TEXT,
        is_inline BOOLEAN DEFAULT 0,
        file_size INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES email_tickets(id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON ticket_attachments(ticket_id)")

    # Tabla de Respuestas Enviadas vía Web / SMTP
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS email_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        recipient_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_html TEXT NOT NULL,
        body_text TEXT NOT NULL,
        status TEXT DEFAULT 'ENVIADO',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES email_tickets(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_replies_ticket ON email_replies(ticket_id)")

    # Asegurar existencia de usuario José Corobo como especialista para validación real
    cursor.execute("SELECT id FROM users WHERE email = 'joseacorobo@gmail.com'")
    jc = cursor.fetchone()
    if not jc:
        import hashlib
        pass_hash = hashlib.sha256("admin".encode("utf-8")).hexdigest()
        cursor.execute("""
        INSERT INTO users (name, email, password_hash, area, role, avatar, shift, status, departamento_id)
        VALUES ('José Corobo', 'joseacorobo@gmail.com', ?, 'Redes de acceso y aprovisionamiento', 'ESPECIALISTA', 'JC', 'Mañana', 'Activo',
                (SELECT id FROM departamentos WHERE codigo = 'ACCESO_APROV'))
        """, (pass_hash,))

    # Perfiles de prueba dedicados: Coordinador y Operador (Especialista)
    import hashlib
    test_hash = hashlib.sha256("inter2026".encode("utf-8")).hexdigest()
    cursor.execute("SELECT id FROM users WHERE email = 'coordinador.pruebas@inter.com.ve'")
    if not cursor.fetchone():
        cursor.execute("""
        INSERT INTO users (name, email, password_hash, area, role, avatar, shift, status, departamento_id)
        VALUES ('Coordinador de Pruebas', 'coordinador.pruebas@inter.com.ve', ?, 'Redes de acceso y aprovisionamiento', 'COORDINADOR', 'CP', 'Mañana', 'Activo',
                (SELECT id FROM departamentos WHERE codigo = 'ACCESO_APROV'))
        """, (test_hash,))

    cursor.execute("SELECT id FROM users WHERE email = 'operador.pruebas@inter.com.ve'")
    if not cursor.fetchone():
        cursor.execute("""
        INSERT INTO users (name, email, password_hash, area, role, avatar, shift, status, departamento_id)
        VALUES ('Operador de Pruebas', 'operador.pruebas@inter.com.ve', ?, 'Redes de acceso y aprovisionamiento', 'ESPECIALISTA', 'OP', 'Mañana', 'Activo',
                (SELECT id FROM departamentos WHERE codigo = 'ACCESO_APROV'))
        """, (test_hash,))

    conn.commit()
    conn.close()

    # Auto-seed para despliegues nuevos (si el catálogo de tareas está vacío)
    conn_check = get_db()
    cur_check = conn_check.cursor()
    cur_check.execute("SELECT COUNT(*) FROM task_types")
    needs_seed = (cur_check.fetchone()[0] == 0)
    conn_check.close()

    if needs_seed:
        try:
            try:
                from seed import seed
            except ImportError:
                from app.seed import seed
            seed(skip_init=True)
        except Exception as seed_err:
            print(f"Aviso en auto-seed de base de datos: {seed_err}")

if __name__ == "__main__":
    init_db()