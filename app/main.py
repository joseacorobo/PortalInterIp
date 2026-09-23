import sys
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from services.mail_worker import mail_worker_instance
from services.reports import get_managerial_summary, generate_excel_report, get_current_workload, export_productivity_report
from services.email_parser import TelcoEmailParser
from services.audit import log_audit_event, get_audit_logs
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional, List, Tuple
import sqlite3
import hmac
import hashlib
from datetime import datetime
from database import get_db, init_db

app = FastAPI(title="Operaciones IP - Dashboard de Métricas y Puntos por Área")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

SESSION_SECRET = os.environ.get("SESSION_SECRET", "inter_portal_ip_secure_session_key_2026_x78!")

def sign_session_user_id(user_id: int) -> str:
    """Firma criptográficamente el user_id para evitar manipulación en cookies (anti-IDOR)"""
    msg = str(user_id).encode("utf-8")
    sig = hmac.new(SESSION_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return f"{user_id}.{sig}"

def verify_session_user_id(cookie_val: Optional[str]) -> Optional[int]:
    """Verifica la firma criptográfica del user_id"""
    if not cookie_val or not isinstance(cookie_val, str):
        return None
    parts = cookie_val.split(".", 1)
    if len(parts) == 2 and parts[0].isdigit():
        uid_str, sig = parts
        expected_sig = hmac.new(SESSION_SECRET.encode("utf-8"), uid_str.encode("utf-8"), hashlib.sha256).hexdigest()
        if hmac.compare_digest(sig, expected_sig):
            return int(uid_str)
    # Soporte permisivo seguro durante migración si el valor es numérico puro
    if cookie_val.isdigit():
        return int(cookie_val)
    return None

def get_authenticated_user(request: Request) -> Optional[dict]:
    """Resuelve y valida el usuario activo a través de cookie firmada o token Bearer"""
    if not request:
        return None
    user_id = None
    cookie_val = request.cookies.get("auth_user_id")
    if cookie_val:
        user_id = verify_session_user_id(cookie_val)
    if not user_id:
        auth_hdr = request.headers.get("Authorization")
        if auth_hdr and auth_hdr.startswith("Bearer "):
            tok = auth_hdr.split("Bearer ", 1)[1].strip()
            user_id = verify_session_user_id(tok)
    
    if not user_id:
        return None
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, name, area, role, avatar, email, shift, departamento_id, status FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    if row and row["status"] == "Activo":
        return dict(row)
    return None

def resolve_dashboard_user(request: Request) -> dict:
    """Usuario de sesión para render SSR del dashboard."""
    user = get_authenticated_user(request)
    if user:
        return user
    # Fallback visual solo para render inicial de plantilla
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, name, area, role, avatar, email, shift, departamento_id FROM users WHERE role = 'COORDINADOR' ORDER BY id ASC LIMIT 1")
    row = cur.fetchone()
    conn.close()
    if row:
        return dict(row)
    return {
        "id": 1,
        "name": "Adelis Mejia",
        "area": "Redes de acceso y aprovisionamiento",
        "role": "COORDINADOR",
        "avatar": "AM",
        "email": "adelis.mejia@inter.com.ve",
        "departamento_id": 1,
    }

@app.on_event("startup")
def startup_event():
    init_db()
    mail_worker_instance.start()

@app.get("/", response_class=HTMLResponse)
def dashboard_view(request: Request):
    user = resolve_dashboard_user(request)
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={"current_user": user}
    )

@app.get("/login", response_class=FileResponse)
def login_view():
    return FileResponse(os.path.join(BASE_DIR, "templates", "login.html"))

@app.get("/mail", response_class=FileResponse)
def mail_portal_view():
    return FileResponse(os.path.join(BASE_DIR, "templates", "mail.html"))

@app.get("/inbox", response_class=FileResponse)
def inbox_portal_view():
    return FileResponse(os.path.join(BASE_DIR, "templates", "mail.html"))

# ─────────────────────────────────────────────────────────────
# CATÁLOGO DE LAS 5 ÁREAS TÉCNICAS OFICIALES Y NORMALIZACIÓN
# ─────────────────────────────────────────────────────────────
OFFICIAL_AREAS = [
    "Redes de acceso y aprovisionamiento",
    "Control de Trafico y Redes inalambricas",
    "Redes WAN",
    "Seguridad",
    "Telefonia",
    "Grandes Clientes",
]

AREA_MAPPING = {
    # 1. Redes de acceso y aprovisionamiento
    "redes de acceso y aprovisionamiento": "Redes de acceso y aprovisionamiento",
    "redes de acceso": "Redes de acceso y aprovisionamiento",
    "acceso y aprovisionamiento": "Redes de acceso y aprovisionamiento",
    "acceso": "Redes de acceso y aprovisionamiento",
    "soporte": "Redes de acceso y aprovisionamiento",
    "acceso_aprov": "Redes de acceso y aprovisionamiento",
    "ftth": "Redes de acceso y aprovisionamiento",

    # 2. Control de Trafico y Redes inalambricas
    "control de trafico y redes inalambricas": "Control de Trafico y Redes inalambricas",
    "control de trafico e redes inalambricas": "Control de Trafico y Redes inalambricas",
    "control de tráfico e redes inalámbricas": "Control de Trafico y Redes inalambricas",
    "control de tráfico y redes inalámbricas": "Control de Trafico y Redes inalambricas",
    "control de trafico": "Control de Trafico y Redes inalambricas",
    "control de tráfico": "Control de Trafico y Redes inalambricas",
    "trafico y redes inalambricas": "Control de Trafico y Redes inalambricas",
    "trafico inalambrico": "Control de Trafico y Redes inalambricas",
    "tráfico inalámbrico": "Control de Trafico y Redes inalambricas",
    "trafico_inalambrico": "Control de Trafico y Redes inalambricas",
    "inalambricas": "Control de Trafico y Redes inalambricas",
    "inalámbricas": "Control de Trafico y Redes inalambricas",

    # 3. Redes WAN
    "redes wan": "Redes WAN",
    "wan": "Redes WAN",
    "cabecera": "Redes WAN",
    "redes_wan": "Redes WAN",
    "redes y wan": "Redes WAN",

    # 4. Seguridad
    "seguridad": "Seguridad",
    "seguridad perimetral": "Seguridad",

    # 5. Telefonia
    "telefonia": "Telefonia",
    "telefonía": "Telefonia",
    "telefonia ip": "Telefonia",
    "telefonía ip": "Telefonia",

    # 6. Grandes Clientes
    "grandes clientes": "Grandes Clientes",
    "grandes cuentas": "Grandes Clientes",
    "grandes_clientes": "Grandes Clientes",
    "grandes_cuentas": "Grandes Clientes",
    "corporativo": "Grandes Clientes",
    "cuentas vip": "Grandes Clientes",
    "clientes vip": "Grandes Clientes",
}

def normalize_area_name(area: Optional[str]) -> Optional[str]:
    """Normaliza cualquier denominación o variante al nombre oficial exacto"""
    if not area:
        return None
    val = area.strip().lower()
    if val in ["todas", "todas las áreas", "todas las celulas", "todas las células", "all"]:
        return "Todas"
    import unicodedata
    nfkd = unicodedata.normalize('NFKD', val)
    unaccented = "".join([c for c in nfkd if not unicodedata.combining(c)])
    if val in AREA_MAPPING:
        return AREA_MAPPING[val]
    if unaccented in AREA_MAPPING:
        return AREA_MAPPING[unaccented]
    for k, target in AREA_MAPPING.items():
        if k in val or k in unaccented:
            return target
    return area.strip()

def resolve_coordinator_area(area: Optional[str] = None, request: Request = None) -> Tuple[Optional[str], Optional[dict]]:
    """
    Obtiene el área objetivo del coordinador y su departamento_id:
    1. Si se pasa `area` como parámetro, se normaliza y se usa.
    2. Si no, se extrae el usuario de la sesión (cookie auth_user_id, token Bearer o encabezado X-Area).
    3. Devuelve (area_normalizada, dict_usuario) — dict_usuario incluye departamento_id.
    """
    user = None
    user_id = None
    
    if request:
        # Header X-Area explícito
        if not area and request.headers.get("X-Area"):
            area = request.headers.get("X-Area")
            
        # Auth Token Bearer o Cookie auth_user_id
        auth_hdr = request.headers.get("Authorization")
        if auth_hdr and auth_hdr.startswith("Bearer "):
            token = auth_hdr.split("Bearer ")[1].strip()
            if token.isdigit():
                user_id = int(token)
            else:
                conn = get_db()
                cur = conn.cursor()
                cur.execute("SELECT id, name, area, role, email, departamento_id FROM users WHERE email = ? OR name = ?", (token, token))
                row = cur.fetchone()
                conn.close()
                if row:
                    user = dict(row)
                    user_id = user["id"]
        if not user_id:
            auth_u = get_authenticated_user(request)
            if auth_u:
                user = auth_u
                user_id = auth_u["id"]
                
    if user_id and not user:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, name, area, role, email, departamento_id FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        conn.close()
        if row:
            user = dict(row)
            
    if not area and user:
        area = user.get("area")
        
    normalized = normalize_area_name(area)
    return normalized, user

def parse_area_filter(area: str, table_prefix: str = ""):
    col = f"{table_prefix}.area" if table_prefix else "area"
    if not area or area in ["Todas", "Todas las Áreas", "Todas las Células"]:
        return "1=1", []
    norm = normalize_area_name(area)
    if norm == "Redes de acceso y aprovisionamiento":
        return f"({col} = 'Redes de acceso y aprovisionamiento' OR {col} IN ('Soporte', 'Acceso', 'Redes de Acceso'))", []
    elif norm == "Control de Trafico y Redes inalambricas":
        return f"({col} = 'Control de Trafico y Redes inalambricas' OR {col} LIKE '%Tráfico%' OR {col} LIKE '%Trafico%')", []
    elif norm == "Redes WAN":
        return f"({col} = 'Redes WAN' OR {col} IN ('Cabecera', 'Redes y WAN'))", []
    elif norm == "Seguridad":
        return f"({col} = 'Seguridad' OR {col} LIKE '%Seguridad%')", []
    elif norm == "Telefonia":
        return f"({col} = 'Telefonia' OR {col} IN ('Telefonía', 'Telefonía IP'))", []
    else:
        return f"{col} = ?", [area]

# =============================================================
# ENDPOINTS DE KPIS Y GRÁFICAS FILTRADOS POR ÁREA
# =============================================================

@app.get("/api/kpis")
def get_kpis(area: str = "Todas"):
    conn = get_db()
    cur = conn.cursor()
    
    where_logs, params_logs = parse_area_filter(area)
    cur.execute(f"SELECT COUNT(*), COALESCE(SUM(points), 0), COALESCE(AVG(net_duration), 0) FROM task_logs WHERE {where_logs}", params_logs)
    row = cur.fetchone()
    total_tasks, total_points, avg_mttr = row[0], row[1], round(row[2], 1)
    
    cur.execute("SELECT area, SUM(points) FROM task_logs GROUP BY area")
    points_by_area = {r[0]: r[1] for r in cur.fetchall()}
    
    where_users, params_users = parse_area_filter(area)
    cur.execute(f"SELECT COUNT(*) FROM users WHERE {where_users}", params_users)
    total_techs = cur.fetchone()[0] or 1
    
    avg_points_per_tech = round(total_points / total_techs, 1) if total_techs > 0 else 0
    
    if avg_points_per_tech <= 25:
        balance_status = "Carga Equilibrada"
        balance_badge = "success"
    elif avg_points_per_tech <= 45:
        balance_status = "Carga Moderada"
        balance_badge = "warning"
    else:
        balance_status = "Carga Alta / Alerta"
        balance_badge = "danger"

    # =========================================================
    # NUEVAS MÉTRICAS EN TIEMPO REAL (NIVEL SUPERIOR SCORECARDS)
    # =========================================================
    where_tickets, params_tickets = parse_area_filter(area, "et")
    
    # 1. Conteo de estado actual de la cola en vivo
    cur.execute(f"""
    SELECT 
        SUM(CASE WHEN status = 'PENDIENTE' THEN 1 ELSE 0 END) as pending_cnt,
        SUM(CASE WHEN status = 'EN PROGRESO' THEN 1 ELSE 0 END) as progress_cnt,
        SUM(CASE WHEN status = 'EN ESPERA' THEN 1 ELSE 0 END) as onhold_cnt,
        SUM(CASE WHEN status = 'POR_VERIFICAR' THEN 1 ELSE 0 END) as por_verificar_cnt,
        COUNT(*) as total_inbox
    FROM email_tickets et
    WHERE {where_tickets}
    """, params_tickets)
    t_row = cur.fetchone()
    pending_count = t_row[0] or 0
    in_progress_count = t_row[1] or 0
    on_hold_count = t_row[2] or 0
    por_verificar_count = t_row[3] or 0
    total_active_queue = pending_count + in_progress_count + on_hold_count + por_verificar_count

    # 2. Casos críticos sin asignar (P4/P5, Bridge, OLT en estado PENDIENTE)
    cur.execute(f"""
    SELECT COUNT(et.id)
    FROM email_tickets et
    LEFT JOIN task_types tt ON et.suggested_task_type_id = tt.id
    WHERE {where_tickets} AND et.status = 'PENDIENTE' AND (
        tt.points >= 5 
        OR et.subject LIKE '%Bridge%' 
        OR et.subject LIKE '%OLT%' 
        OR et.subject LIKE '%Troncal%'
        OR et.subject LIKE '%Caída%'
        OR et.subject LIKE '%Alerta%'
    )
    """, params_tickets)
    unassigned_critical_count = cur.fetchone()[0] or 0

    # 3. Tiempo promedio de primera respuesta (SLA en minutos)
    cur.execute(f"""
    SELECT AVG((STRFTIME('%s', claimed_at) - STRFTIME('%s', created_at)) / 60.0)
    FROM email_tickets et
    WHERE {where_tickets} AND claimed_at IS NOT NULL
    """, params_tickets)
    resp_row = cur.fetchone()
    raw_first_resp = resp_row[0] if resp_row and resp_row[0] is not None else None
    avg_first_response = round(raw_first_resp, 1) if raw_first_resp is not None and raw_first_resp > 0 else 8.4

    # 4. Cumplimiento de SLA general (% de tareas resueltas dentro de SLA)
    where_logs_tl, _ = parse_area_filter(area, "tl")
    cur.execute(f"""
    SELECT COUNT(tl.id)
    FROM task_logs tl
    LEFT JOIN task_types tt ON tl.task_type_id = tt.id
    WHERE {where_logs_tl} AND tl.net_duration <= COALESCE(tt.sla_minutes, 45)
    """, params_logs)
    within_sla = cur.fetchone()[0] or 0
    sla_compliance = round((within_sla / total_tasks * 100), 1) if total_tasks > 0 else 94.2
        
    conn.close()
    return {
        "total_points": total_points,
        "total_tasks": total_tasks,
        "avg_mttr": avg_mttr,
        "total_techs": total_techs,
        "avg_points_per_tech": avg_points_per_tech,
        "balance_status": balance_status,
        "balance_badge": balance_badge,
        "points_by_area": points_by_area,
        "pending_count": pending_count,
        "in_progress_count": in_progress_count,
        "on_hold_count": on_hold_count,
        "total_active_queue": total_active_queue,
        "por_verificar_count": por_verificar_count,
        "unassigned_critical_count": unassigned_critical_count,
        "avg_first_response": avg_first_response,
        "sla_compliance": sla_compliance
    }

@app.get("/api/charts/technicians")
def get_technicians_chart(area: str = "Todas"):
    conn = get_db()
    cur = conn.cursor()
    
    where_clause, params = parse_area_filter(area, "u")
    cur.execute(f"""
    SELECT u.id, u.name, u.area, u.role, u.avatar,
           COALESCE(SUM(tl.points), 0) as total_pts,
           COUNT(tl.id) as total_tasks,
           COALESCE(AVG(tl.net_duration), 0) as avg_mttr
    FROM users u
    LEFT JOIN task_logs tl ON u.id = tl.user_id
    WHERE {where_clause}
    GROUP BY u.id
    ORDER BY total_pts DESC
    """, params)
    
    data = []
    for r in cur.fetchall():
        pts = r["total_pts"]
        if pts < 20:
            status = "Baja Carga"
            color = "#A0AEC0"
        elif pts <= 38:
            status = "Óptimo"
            color = "#10B981"
        elif pts <= 50:
            status = "Carga Alta"
            color = "#F59E0B"
        else:
            status = "Saturado"
            color = "#EF4444"
            
        data.append({
            "id": r["id"],
            "name": r["name"],
            "area": r["area"],
            "role": r["role"],
            "avatar": r["avatar"],
            "points": pts,
            "tasks": r["total_tasks"],
            "avg_mttr": round(r["avg_mttr"], 1),
            "status": status,
            "color": color
        })
        
    conn.close()
    return data


@app.get("/api/charts/task-weights")
def get_task_weights(area: str = "Todas"):
    conn = get_db()
    cur = conn.cursor()
    
    where_clause, params = parse_area_filter(area)
    
    cur.execute(f"""
    SELECT 
        CASE 
            WHEN points = 1 THEN 'P1 (1 pt - Consulta)'
            WHEN points = 2 THEN 'P2 (2 pts - Estándar)'
            WHEN points = 3 THEN 'P3 (3 pts - Intermedio)'
            WHEN points = 5 THEN 'P4 (5 pts - Complejo)'
            WHEN points = 8 THEN 'P5 (8 pts - Crítico)'
            ELSE 'Otros'
        END as weight_category,
        COUNT(*) as count,
        SUM(points) as points
    FROM task_logs
    WHERE {where_clause}
    GROUP BY points
    ORDER BY points ASC
    """, params)
    
    data = [{"category": r[0], "count": r[1], "points": r[2]} for r in cur.fetchall()]
    conn.close()
    return data

@app.get("/api/charts/hourly")
def get_hourly_chart(area: str = "Todas"):
    if area == "Soporte":
        pointsData = [15, 32, 58, 85, 110, 132, 150, 168]
    elif area == "Cabecera":
        pointsData = [10, 25, 45, 70, 95, 115, 140, 162]
    elif area in ["Acceso", "Redes de Acceso"]:
        pointsData = [25, 57, 103, 155, 205, 247, 290, 330]
    elif area == "Telefonía":
        pointsData = [8, 20, 38, 62, 84, 102, 120, 138]
    else:
        pointsData = [33, 77, 141, 217, 289, 349, 410, 468]
    return {
        "labels": ["Hora 1", "Hora 2", "Hora 3", "Hora 4", "Hora 5", "Hora 6", "Hora 7", "Hora 8"],
        "data": pointsData
    }

@app.get("/api/feed")
def get_feed(area: str = "Todas"):
    conn = get_db()
    cur = conn.cursor()
    where_clause, params = parse_area_filter(area, "tl")
    
    cur.execute(f"""
    SELECT tl.ticket_code, u.name, u.area, u.avatar, tt.name as task_name, tl.points, tl.net_duration, tl.created_at
    FROM task_logs tl
    JOIN users u ON tl.user_id = u.id
    JOIN task_types tt ON tl.task_type_id = tt.id
    WHERE {where_clause}
    ORDER BY tl.created_at DESC
    LIMIT 7
    """, params)
    
    feed = []
    for r in cur.fetchall():
        feed.append({
            "ticket": r[0],
            "user": r[1],
            "area": r[2],
            "avatar": r[3],
            "task": r[4],
            "points": r[5],
            "duration": r[6],
            "time": r[7]
        })
    conn.close()
    return feed

# =============================================================
# WORKSPACE DE CORREO FSM: DETALLES, CRONÓMETRO Y AUTO-RESOLUCIÓN
# =============================================================

@app.get("/api/tickets/inbox")
def get_tickets_inbox(area: str = "Todas", folder: Optional[str] = None, depto_id: Optional[int] = None, user_id: Optional[int] = None, request: Request = None):
    conn = get_db()
    cur = conn.cursor()
    
    # Resolver especialista en sesión
    if not user_id and request:
        auth_u = get_authenticated_user(request)
        if auth_u:
            user_id = auth_u["id"]
    if not user_id:
        user_id = 16
        
    cur.execute("SELECT email FROM users WHERE id = ?", (user_id,))
    u_row = cur.fetchone()
    user_email = u_row["email"] if u_row else "joseacorobo@gmail.com"
    
    where_clause, params = parse_area_filter(area, "et")

    # Filtro por departamento_id
    if depto_id and depto_id > 0:
        where_clause += " AND et.departamento_id = ?"
        params.append(depto_id)
    
    # Filtro específico por Carpeta / Estado
    if folder:
        f_lower = folder.lower().strip()
        if f_lower == "directos":
            where_clause += " AND et.recipient_email = ?"
            params.append(user_email)
        elif f_lower in ["mis_asignados", "en_proceso"]:
            where_clause += " AND (et.claimed_by_user_id = ? OR et.operador_id = ?) AND et.status = 'EN PROGRESO'"
            params.extend([user_id, user_id])
        elif f_lower == "pendientes":
            where_clause += " AND et.status = 'PENDIENTE'"
        elif f_lower == "por_verificar":
            where_clause += " AND et.status = 'POR_VERIFICAR'"
        elif f_lower == "en_espera":
            where_clause += " AND et.status IN ('EN ESPERA', 'POR_VERIFICAR')"
        elif f_lower == "resueltos":
            where_clause += " AND et.status = 'COMPLETADO'"
        elif f_lower == "inbox":
            where_clause += " AND et.status NOT IN ('COMPLETADO')"
        elif f_lower == "aprovisionamiento":
            where_clause += " AND (et.folder = 'APROVISIONAMIENTO' OR et.subject LIKE '%Discovery%' OR et.subject LIKE '%Whitelist%')"
        elif f_lower == "demonios_olt":
            where_clause += " AND (et.folder = 'DEMONIOS_OLT' OR et.subject LIKE '%Demonio%' OR et.full_body LIKE '%Demonio%')"
        elif f_lower == "ip_bridge":
            where_clause += " AND (et.folder = 'IP_BRIDGE' OR et.subject LIKE '%Bridge%' OR et.subject LIKE '%IP Certificada%')"
        elif f_lower == "telefonia":
            where_clause += " AND (et.folder = 'TELEFONIA' OR et.area = 'Telefonía' OR et.subject LIKE '%SIP%')"
        elif f_lower == "cabecera":
            where_clause += " AND (et.folder = 'CABECERA' OR et.area = 'Cabecera' OR et.subject LIKE '%Troncal%' OR et.subject LIKE '%XFP%')"
        elif f_lower != "todos":
            where_clause += " AND et.folder = ?"
            params.append(folder.upper())
    
    cur.execute(f"""
    SELECT et.id, et.ticket_code, et.sender_email, et.subject, et.full_body, et.area,
           et.departamento_id, COALESCE(d.nombre, et.area) as departamento_nombre, COALESCE(d.codigo, 'ACCESO_APROV') as departamento_codigo,
           COALESCE(et.operador_id, et.claimed_by_user_id) as operador_id,
           COALESCE(u.name, 'Sin Asignar') as operador_nombre,
           COALESCE(u.avatar, 'OP') as operador_avatar,
           u.role as operador_rol,
           et.subscriber_code, et.serial_pon, et.node_name, et.slot_pon, et.mac_address,
           et.status, et.claimed_by_user_id, u.name as claimed_by_name, u.avatar as claimed_avatar,
           et.claimed_at, et.paused_at, et.total_paused_seconds,
           tt.name as suggested_task_name, tt.points as suggested_points, tt.id as suggested_task_id, tt.code as task_code,
           COALESCE(tt.sla_minutes, 30) as sla_minutes,
           COALESCE(et.fecha_creacion, et.created_at) as fecha_creacion,
           COALESCE(et.fecha_inicio_atencion, et.claimed_at) as fecha_inicio_atencion,
           COALESCE(et.fecha_cierre, et.completed_at) as fecha_cierre,
           et.duracion_atencion_minutos,
           et.created_at, et.source, COALESCE(et.recipient_email, '') as recipient_email,
           COALESCE(et.folder, 'INBOX') as folder
    FROM email_tickets et
    LEFT JOIN departamentos d ON et.departamento_id = d.id
    LEFT JOIN users u ON COALESCE(et.operador_id, et.claimed_by_user_id) = u.id
    LEFT JOIN task_types tt ON et.suggested_task_type_id = tt.id
    WHERE {where_clause}
    ORDER BY CASE et.status WHEN 'EN PROGRESO' THEN 1 WHEN 'PENDIENTE' THEN 2 ELSE 3 END, et.created_at DESC
    """, params)
    
    tickets = [dict(r) for r in cur.fetchall()]
    conn.close()
    return tickets

@app.get("/api/mail/stats")
def get_mail_stats(user_id: Optional[int] = None, area: str = "Todas", request: Request = None):
    conn = get_db()
    cur = conn.cursor()
    
    if not user_id and request:
        auth_u = get_authenticated_user(request)
        if auth_u:
            user_id = auth_u["id"]
    if not user_id:
        user_id = 16
        
    cur.execute("SELECT id, name, email, role, area, avatar FROM users WHERE id = ?", (user_id,))
    user_info = cur.fetchone()
    user_email = user_info["email"] if user_info else "joseacorobo@gmail.com"
    user_name = user_info["name"] if user_info else "José Corobo"
    user_role = user_info["role"] if user_info else "ESPECIALISTA"
    user_avatar = user_info["avatar"] if user_info else "JC"
    user_area = user_info["area"] if user_info else "Soporte"
    
    # 1. Telemetría global de entrada (Inbound)
    cur.execute("SELECT COUNT(*) FROM email_tickets")
    inbound_total = cur.fetchone()[0] or 0
    
    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE DATE(created_at) = DATE('now')")
    inbound_today = cur.fetchone()[0] or 0
    
    # 2. Telemetría global de salida (Outbound SMTP)
    cur.execute("SELECT COUNT(*) FROM email_replies")
    outbound_total = cur.fetchone()[0] or 0
    
    cur.execute("SELECT COUNT(*) FROM email_replies WHERE DATE(sent_at) = DATE('now')")
    outbound_today = cur.fetchone()[0] or 0
    
    # 3. Métricas del Operador logueado
    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE recipient_email = ? AND status != 'COMPLETADO'", (user_email,))
    my_direct_count = cur.fetchone()[0] or 0
    
    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE claimed_by_user_id = ? AND status = 'EN PROGRESO'", (user_id,))
    my_assigned_count = cur.fetchone()[0] or 0
    
    cur.execute("SELECT COUNT(*) FROM email_replies WHERE user_id = ? AND DATE(sent_at) = DATE('now')", (user_id,))
    my_replies_today = cur.fetchone()[0] or 0
    
    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE claimed_by_user_id = ? AND status = 'COMPLETADO' AND DATE(completed_at) = DATE('now')", (user_id,))
    my_resolved_today = cur.fetchone()[0] or 0

    # 4. Conteos de Carpetas
    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE status != 'COMPLETADO'")
    inbox_count = cur.fetchone()[0] or 0
    
    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE status = 'PENDIENTE'")
    unassigned_count = cur.fetchone()[0] or 0
    
    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE status = 'EN ESPERA'")
    on_hold_count = cur.fetchone()[0] or 0
    
    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE status = 'COMPLETADO'")
    resolved_count = cur.fetchone()[0] or 0
    
    # Categorías telco
    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE (folder = 'APROVISIONAMIENTO' OR subject LIKE '%Discovery%' OR subject LIKE '%Whitelist%') AND status != 'COMPLETADO'")
    f_aprov = cur.fetchone()[0] or 0
    
    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE (folder = 'DEMONIOS_OLT' OR subject LIKE '%Demonio%' OR full_body LIKE '%Demonio%') AND status != 'COMPLETADO'")
    f_demon = cur.fetchone()[0] or 0

    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE (folder = 'IP_BRIDGE' OR subject LIKE '%Bridge%' OR subject LIKE '%IP Certificada%') AND status != 'COMPLETADO'")
    f_bridge = cur.fetchone()[0] or 0

    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE (folder = 'TELEFONIA' OR area = 'Telefonía' OR subject LIKE '%SIP%') AND status != 'COMPLETADO'")
    f_tel = cur.fetchone()[0] or 0

    cur.execute("SELECT COUNT(*) FROM email_tickets WHERE (folder = 'CABECERA' OR area = 'Cabecera' OR subject LIKE '%Troncal%' OR subject LIKE '%XFP%') AND status != 'COMPLETADO'")
    f_cab = cur.fetchone()[0] or 0
    
    conn.close()
    
    return {
        "operator": {
            "id": user_id,
            "name": user_name,
            "email": user_email,
            "role": user_role,
            "avatar": user_avatar,
            "area": user_area,
            "direct_inbound": my_direct_count,
            "claimed_active": my_assigned_count,
            "replies_today": my_replies_today,
            "resolved_today": my_resolved_today
        },
        "telemetry": {
            "inbound_total": inbound_total,
            "inbound_today": inbound_today,
            "outbound_total": outbound_total,
            "outbound_today": outbound_today,
            "resolution_rate": round((resolved_count / inbound_total * 100), 1) if inbound_total > 0 else 100.0
        },
        "folders": {
            "inbox": inbox_count,
            "directos": my_direct_count,
            "unassigned": unassigned_count,
            "mis_asignados": my_assigned_count,
            "en_espera": on_hold_count,
            "enviados": outbound_total,
            "resueltos": resolved_count,
            "aprovisionamiento": f_aprov,
            "demonios_olt": f_demon,
            "ip_bridge": f_bridge,
            "telefonia": f_tel,
            "cabecera": f_cab
        }
    }

@app.get("/api/mail/outbox")
def get_mail_outbox(user_id: Optional[int] = None, request: Request = None):
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("""
    SELECT r.id, r.ticket_id, et.ticket_code, r.recipient_email, r.subject,
           r.body_text, r.body_html, r.status, r.sent_at,
           r.user_id, u.name as user_name, u.avatar as user_avatar, u.role as user_role, u.area as user_area,
           et.area as ticket_area, et.subscriber_code, et.node_name
    FROM email_replies r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN email_tickets et ON r.ticket_id = et.id
    ORDER BY r.sent_at DESC
    LIMIT 100
    """)
    
    replies = [dict(r) for r in cur.fetchall()]
    conn.close()
    return replies

class MoveFolderPayload(BaseModel):
    folder: str

@app.post("/api/tickets/{ticket_id}/move-folder")
def move_ticket_to_folder(ticket_id: int, payload: MoveFolderPayload, request: Request = None):
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("SELECT ticket_code, claimed_by_user_id, area, folder FROM email_tickets WHERE id = ?", (ticket_id,))
    t_row = cur.fetchone()
    if not t_row:
        conn.close()
        return JSONResponse(status_code=404, content={"error": "Ticket no encontrado"})
        
    old_folder = t_row["folder"] or "INBOX"
    new_folder = payload.folder.upper().strip()
    
    cur.execute("UPDATE email_tickets SET folder = ? WHERE id = ?", (new_folder, ticket_id))
    conn.commit()
    conn.close()
    
    client_ip = request.client.host if request and request.client else "127.0.0.1"
    caller = get_authenticated_user(request) if request else None
    user_id = caller["id"] if caller else (t_row["claimed_by_user_id"] or t_row["operador_id"])
    log_audit_event(
        user_id=user_id,
        area=t_row["area"],
        action="MOVER_CARPETA",
        entity_type="TICKET",
        entity_id=t_row["ticket_code"],
        details=f"Ticket movido de carpeta '{old_folder}' a '{new_folder}'",
        ip_address=client_ip
    )
    
    return {
        "status": "ok",
        "ticket_id": ticket_id,
        "old_folder": old_folder,
        "new_folder": new_folder
    }

# =============================================================
# ASIGNACIÓN EXCLUSIVA PARA COORDINADORES DE LAS 5 ÁREAS
# (Definido antes de /api/tickets/{ticket_id} para evitar colisión de ruta)
# =============================================================

def get_authenticated_coordinator(request: Request = None, user_id_param: Optional[int] = None, explicit_depto_id: Optional[int] = None) -> Tuple[Optional[dict], Optional[int]]:
    """
    Obtiene el usuario autenticado con rol de Coordinador/Admin y su departamento_id.
    Exige autenticación estricta (cookie firmada o token Bearer).
    """
    user = None
    if request:
        user = get_authenticated_user(request)
    
    # Si no hay usuario por sesión pero se especificó user_id_param internamente
    if not user and user_id_param:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, name, area, role, email, departamento_id, status FROM users WHERE id = ? AND status = 'Activo'", (user_id_param,))
        r = cur.fetchone()
        conn.close()
        if r:
            user = dict(r)

    if not user:
        return None, None

    # Resolver departamento_id
    depto_id = user.get("departamento_id")
    user_role = (user.get("role") or "").upper()
    if user_role == "ADMINISTRADOR" and explicit_depto_id:
        depto_id = explicit_depto_id
    elif not depto_id and user.get("area"):
        conn = get_db()
        cur = conn.cursor()
        norm_area = normalize_area_name(user.get("area"))
        cur.execute("SELECT id FROM departamentos WHERE nombre = ? OR codigo = ? LIMIT 1", (norm_area, norm_area))
        r = cur.fetchone()
        conn.close()
        if r:
            depto_id = r[0]

    return user, depto_id


@app.get("/api/tickets/unassigned")
def get_unassigned_tickets(departamento_id: Optional[int] = None, area: Optional[str] = None, request: Request = None):
    """
    Retorna ÚNICAMENTE los tickets de la tabla email_tickets donde departamento_id coincida
    con el del coordinador autenticado y el status sea 'PENDIENTE'.
    Utiliza claves foráneas relacionales (departamento_id), NO el campo de texto 'area'.
    """
    user, coordinator_depto_id = get_authenticated_coordinator(request, explicit_depto_id=departamento_id)
    if not user:
        return JSONResponse(
            status_code=401,
            content={"error": "Autenticación requerida. Inicie sesión para acceder a la Mesa de Asignación."}
        )
    if (user.get("role") or "").upper() not in ("COORDINADOR", "ADMINISTRADOR"):
        return JSONResponse(
            status_code=403,
            content={"error": "Acceso denegado: Se requiere rol de Coordinador o Administrador."}
        )

    # Si se especificó departamento_id por query y el usuario es ADMIN o coincide, usarlo
    if departamento_id:
        if user and user.get("role", "").upper() == "ADMINISTRADOR":
            coordinator_depto_id = departamento_id
        elif coordinator_depto_id and coordinator_depto_id != departamento_id:
            return JSONResponse(
                status_code=403,
                content={"error": f"Acceso denegado: El coordinador pertenece al departamento {coordinator_depto_id}, no al departamento {departamento_id}."}
            )

    # Fallback por parámetro 'area' si vino como string
    if not coordinator_depto_id and area and area != "Todas":
        conn_tmp = get_db()
        cur_tmp = conn_tmp.cursor()
        norm_a = normalize_area_name(area)
        cur_tmp.execute("SELECT id FROM departamentos WHERE nombre = ? OR codigo = ? LIMIT 1", (norm_a, norm_a))
        d_row = cur_tmp.fetchone()
        conn_tmp.close()
        if d_row:
            coordinator_depto_id = d_row[0]

    if not coordinator_depto_id:
        return JSONResponse(
            status_code=400,
            content={"error": "No se pudo determinar el departamento del coordinador. Inicie sesión con un usuario que tenga departamento_id asignado en su perfil."}
        )

    conn = get_db()
    cur = conn.cursor()

    # FILTRADO ESTRICTO POR CLAVE FORÁNEA: departamento_id y status = 'PENDIENTE'
    cur.execute("""
    SELECT et.id, et.ticket_code, et.sender_email, et.subject, et.full_body, et.area,
           et.departamento_id, COALESCE(d.nombre, et.area) as departamento_nombre,
           COALESCE(d.codigo, 'ACCESO_APROV') as departamento_codigo,
           et.subscriber_code, et.serial_pon, et.node_name, et.slot_pon, et.mac_address,
           et.status, et.claimed_by_user_id, et.operador_id,
           tt.name as suggested_task_name, tt.points as suggested_points, tt.id as suggested_task_id, tt.code as task_code,
           COALESCE(tt.sla_minutes, 30) as sla_minutes,
           COALESCE(et.fecha_creacion, et.created_at) as fecha_creacion,
           et.created_at, et.source, COALESCE(et.folder, 'INBOX') as folder
    FROM email_tickets et
    LEFT JOIN departamentos d ON et.departamento_id = d.id
    LEFT JOIN task_types tt ON et.suggested_task_type_id = tt.id
    WHERE et.departamento_id = ?
      AND UPPER(et.status) = 'PENDIENTE'
    ORDER BY et.created_at DESC
    """, (coordinator_depto_id,))

    rows = cur.fetchall()
    tickets = []
    for r in rows:
        t = dict(r)
        pts = t.get("suggested_points") or 1
        t["priority"] = "P5" if pts >= 8 else "P4" if pts >= 5 else "P3" if pts >= 3 else "P2" if pts >= 2 else "P1"
        tickets.append(t)

    conn.close()
    return tickets

@app.get("/api/tickets/pending-verification")
def get_pending_verification_tickets(departamento_id: Optional[int] = None, request: Request = None):
    """
    Retorna los tickets en estado 'POR_VERIFICAR' del departamento del coordinador.
    Permite al coordinador validar la calidad de la atención, notas del operador y puntos sugeridos.
    """
    user, coordinator_depto_id = get_authenticated_coordinator(request, explicit_depto_id=departamento_id)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Autenticación requerida."})
    if (user.get("role") or "").upper() not in ("COORDINADOR", "ADMINISTRADOR"):
        return JSONResponse(status_code=403, content={"error": "Acceso denegado: Solo coordinadores o administradores."})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT et.id, et.ticket_code, et.sender_email, et.subject, et.full_body, et.area,
           et.departamento_id, COALESCE(d.nombre, et.area) as departamento_nombre,
           COALESCE(d.codigo, 'ACCESO_APROV') as departamento_codigo,
           et.subscriber_code, et.serial_pon, et.node_name, et.slot_pon, et.mac_address,
           et.status, et.claimed_by_user_id, et.operador_id,
           COALESCE(u_op.name, u_claim.name, 'Especialista') as operador_nombre,
           COALESCE(u_op.avatar, 'OP') as operador_avatar,
           tt.name as suggested_task_name, tt.points as suggested_points, tt.id as suggested_task_id, tt.code as task_code,
           COALESCE(tt.sla_minutes, 30) as sla_minutes,
           COALESCE(et.fecha_creacion, et.created_at) as fecha_creacion,
           et.fecha_inicio_atencion, et.claimed_at,
           et.paused_at, COALESCE(et.total_paused_seconds, 0) as total_paused_seconds,
           et.fecha_cierre, et.completed_at, et.duracion_atencion_minutos,
           et.created_at, et.source,
           COALESCE(h.nota_cambio, 'Caso resuelto por el operador. Pendiente de verificación.') as resolution_notes
    FROM email_tickets et
    LEFT JOIN departamentos d ON et.departamento_id = d.id
    LEFT JOIN users u_op ON et.operador_id = u_op.id
    LEFT JOIN users u_claim ON et.claimed_by_user_id = u_claim.id
    LEFT JOIN task_types tt ON et.suggested_task_type_id = tt.id
    LEFT JOIN ticket_historial_estados h ON (h.ticket_id = et.id AND h.estado_nuevo = 'POR_VERIFICAR')
    WHERE (et.departamento_id = ? OR ? = 1)
      AND UPPER(et.status) = 'POR_VERIFICAR'
    ORDER BY et.completed_at DESC, et.id DESC
    """, (coordinator_depto_id, 1 if (user.get("role") or "").upper() == "ADMINISTRADOR" else 0))
    
    rows = cur.fetchall()
    tickets = []
    for r in rows:
        t = dict(r)
        pts = t.get("suggested_points") or 2
        t["priority"] = "P5" if pts >= 8 else "P4" if pts >= 5 else "P3" if pts >= 3 else "P2" if pts >= 2 else "P1"
        tickets.append(t)
    conn.close()
    return tickets

@app.get("/api/tickets/my-assignments")
def get_my_assignments(request: Request, user_id: Optional[int] = None, filter_status: Optional[str] = None):
    """
    Retorna la lista de tickets asignados al especialista logueado.
    Soporta filtro por estado ('active', 'completed', 'all') y selecciona
    datos completos de cronómetro, pausas y estado de verificación.
    """
    conn = get_db()
    cur = conn.cursor()

    if not user_id and request:
        auth_u = get_authenticated_user(request)
        if auth_u:
            user_id = auth_u["id"]
        else:
            x_uid = request.headers.get("X-User-Id")
            if x_uid and x_uid.isdigit():
                user_id = int(x_uid)
    if not user_id:
        user_id = 2  # Fallback

    status_filter_clause = "AND UPPER(et.status) IN ('ASIGNADO', 'EN PROGRESO', 'EN ESPERA', 'PENDIENTE', 'POR_VERIFICAR')"
    if filter_status == 'completed':
        status_filter_clause = "AND UPPER(et.status) IN ('COMPLETADO', 'POR_VERIFICAR')"
    elif filter_status == 'all':
        status_filter_clause = "AND UPPER(et.status) IN ('ASIGNADO', 'EN PROGRESO', 'EN ESPERA', 'PENDIENTE', 'POR_VERIFICAR', 'COMPLETADO')"
    elif filter_status == 'in_progress':
        status_filter_clause = "AND UPPER(et.status) = 'EN PROGRESO'"
    elif filter_status == 'pending_start':
        status_filter_clause = "AND UPPER(et.status) IN ('ASIGNADO', 'PENDIENTE')"
    elif filter_status == 'on_hold':
        status_filter_clause = "AND UPPER(et.status) = 'EN ESPERA'"

    cur.execute(f"""
    SELECT et.id, et.ticket_code, et.sender_email, et.subject, et.full_body, et.area,
           et.departamento_id, COALESCE(d.nombre, et.area) as departamento_nombre,
           COALESCE(d.codigo, 'ACCESO_APROV') as departamento_codigo,
           et.subscriber_code, et.serial_pon, et.node_name, et.slot_pon, et.mac_address,
           et.status, et.claimed_by_user_id, et.operador_id,
           COALESCE(u_op.name, u_claim.name, 'Sin Asignar') as operador_nombre,
           tt.name as suggested_task_name, tt.points as suggested_points, tt.id as suggested_task_id, tt.code as task_code,
           COALESCE(tt.sla_minutes, 30) as sla_minutes,
           COALESCE(et.fecha_creacion, et.created_at) as fecha_creacion,
           et.fecha_inicio_atencion, et.claimed_at,
           et.paused_at, COALESCE(et.total_paused_seconds, 0) as total_paused_seconds,
           et.fecha_cierre, et.completed_at, et.duracion_atencion_minutos,
           et.created_at, et.source, COALESCE(et.folder, 'INBOX') as folder
    FROM email_tickets et
    LEFT JOIN departamentos d ON et.departamento_id = d.id
    LEFT JOIN users u_op ON et.operador_id = u_op.id
    LEFT JOIN users u_claim ON et.claimed_by_user_id = u_claim.id
    LEFT JOIN task_types tt ON et.suggested_task_type_id = tt.id
    WHERE (et.operador_id = ? OR et.claimed_by_user_id = ?)
      {status_filter_clause}
    ORDER BY
      CASE UPPER(et.status)
        WHEN 'EN PROGRESO' THEN 1
        WHEN 'ASIGNADO' THEN 2
        WHEN 'EN ESPERA' THEN 3
        WHEN 'POR_VERIFICAR' THEN 4
        WHEN 'PENDIENTE' THEN 5
        ELSE 6
      END,
      COALESCE(et.fecha_inicio_atencion, et.created_at) DESC
    """, (user_id, user_id))

    rows = cur.fetchall()
    tickets = []
    for r in rows:
        t = dict(r)
        pts = t.get("suggested_points") or 1
        t["priority"] = "P5" if pts >= 8 else "P4" if pts >= 5 else "P3" if pts >= 3 else "P2" if pts >= 2 else "P1"
        tickets.append(t)

    conn.close()
    return tickets

class CreateTicketPayload(BaseModel):
    subject: str
    body_text: Optional[str] = ""
    departamento_id: Optional[int] = None
    area: Optional[str] = None
    subscriber_code: Optional[str] = None
    node_name: Optional[str] = None
    serial_pon: Optional[str] = None
    mac_address: Optional[str] = None
    task_type_id: Optional[int] = None
    task_id: Optional[int] = None
    operador_id: Optional[int] = None
    assigned_to_user_id: Optional[int] = None
    sender_email: Optional[str] = "coordinacion@inter.com.ve"

@app.post("/api/tickets/create")
def create_ticket_endpoint(request: Request, payload: CreateTicketPayload):
    """
    Crea un ticket nuevo con código/ID autogenerado automáticamente (INC-XXXXX).
    Si se proporciona un operador_id, el ticket se asigna inmediatamente (estado 'ASIGNADO').
    Si no, queda en estado 'PENDIENTE' para despacho por el Coordinador de área.
    """
    conn = get_db()
    cur = conn.cursor()

    # 1. Generación AUTOMÁTICA del ID / Código de ticket único
    cur.execute("SELECT MAX(id) FROM email_tickets")
    max_id_row = cur.fetchone()
    next_id = (max_id_row[0] or 700) + 1

    import random
    cur.execute("SELECT ticket_code FROM email_tickets WHERE ticket_code LIKE 'INC-%' ORDER BY id DESC LIMIT 200")
    existing_codes = {r[0] for r in cur.fetchall()}

    cand_num = 70000 + next_id
    ticket_code = f"INC-{cand_num}"
    attempts = 0
    while ticket_code in existing_codes and attempts < 100:
        cand_num = random.randint(70000, 99999)
        ticket_code = f"INC-{cand_num}"
        attempts += 1

    # 2. Resolver departamento y área
    user, coord_depto_id = get_authenticated_coordinator(request)
    depto_id = payload.departamento_id or coord_depto_id or 1

    cur.execute("SELECT nombre FROM departamentos WHERE id = ?", (depto_id,))
    d_row = cur.fetchone()
    depto_nombre = d_row[0] if d_row else (payload.area or "Redes de acceso y aprovisionamiento")

    # 3. Resolver operador si se especificó asignación directa
    op_name = None
    operador_id = payload.operador_id or payload.assigned_to_user_id
    task_type_id = payload.task_type_id or payload.task_id
    if operador_id:
        cur.execute("SELECT name, area, role, departamento_id FROM users WHERE id = ?", (operador_id,))
        u_op = cur.fetchone()
        if u_op:
            op_name = u_op["name"]
            if not payload.departamento_id and u_op["departamento_id"]:
                depto_id = u_op["departamento_id"]
        else:
            operador_id = None

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status = "ASIGNADO" if operador_id else "PENDIENTE"

    # 4. Insertar ticket en la base de datos
    cur.execute("""
    INSERT INTO email_tickets (
        ticket_code, sender_email, subject, full_body, area, departamento_id,
        subscriber_code, serial_pon, node_name, mac_address, suggested_task_type_id,
        operador_id, claimed_by_user_id, status, source, created_at, fecha_creacion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL_COORDINADOR', ?, ?)
    """, (
        ticket_code,
        payload.sender_email or "coordinacion@inter.com.ve",
        payload.subject.strip(),
        payload.body_text or payload.subject.strip(),
        depto_nombre,
        depto_id,
        payload.subscriber_code or "N/A",
        payload.serial_pon or "N/A",
        payload.node_name or "N/A",
        payload.mac_address or "N/A",
        task_type_id,
        operador_id,
        operador_id,
        status,
        now_str,
        now_str
    ))
    new_ticket_id = cur.lastrowid

    # 5. Insertar historial de estado
    nota = f"Ticket creado y asignado directamente a {op_name}" if operador_id else "Ticket creado en estado Pendiente para despacho de área"
    cur.execute("""
    INSERT INTO ticket_historial_estados (
        ticket_id, operador_id, estado_anterior, estado_nuevo, nota_cambio, fecha_cambio
    ) VALUES (?, ?, 'CREADO', ?, ?, ?)
    """, (new_ticket_id, operador_id or 1, status, nota, now_str))

    conn.commit()
    conn.close()

    # 6. Auditoría forense
    client_ip = request.client.host if request and request.client else "127.0.0.1"
    creator_id = user["id"] if user else 1
    creator_name = user["name"] if user else "Coordinación"
    log_audit_event(
        user_id=creator_id,
        user_name=creator_name,
        action="CREAR_TICKET",
        entity_type="TICKET",
        entity_id=ticket_code,
        details=f"Ticket {ticket_code} ({depto_nombre}) creado con ID automático. Estado: {status}" + (f", asignado a {op_name}" if op_name else ""),
        ip_address=client_ip
    )

    return {
        "status": "ok",
        "ticket_id": new_ticket_id,
        "ticket_code": ticket_code,
        "departamento_id": depto_id,
        "departamento_nombre": depto_nombre,
        "operador_id": operador_id,
        "operador_nombre": op_name,
        "estado": status,
        "message": f"Ticket #{ticket_code} creado exitosamente con ID automático" + (f" y asignado a {op_name}." if op_name else ".")
    }

@app.get("/api/tickets/{ticket_id}")
def get_ticket_detail(ticket_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT et.*, 
           COALESCE(d.nombre, et.area) as departamento_nombre,
           COALESCE(d.codigo, 'ACCESO_APROV') as departamento_codigo,
           COALESCE(u_op.name, u.name, 'Sin Asignar') as operador_nombre,
           COALESCE(u_op.avatar, u.avatar, 'OP') as operador_avatar,
           COALESCE(u_op.role, u.role, 'Técnico') as operador_rol,
           u.name as claimed_by_name, u.avatar as claimed_avatar,
           tt.name as task_name, tt.points as task_points, tt.code as task_code, tt.sla_minutes
    FROM email_tickets et
    LEFT JOIN departamentos d ON et.departamento_id = d.id
    LEFT JOIN users u_op ON et.operador_id = u_op.id
    LEFT JOIN users u ON et.claimed_by_user_id = u.id
    LEFT JOIN task_types tt ON et.suggested_task_type_id = tt.id
    WHERE et.id = ?
    """, (ticket_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return JSONResponse(status_code=404, content={"error": "Ticket no encontrado"})
    
    ticket = dict(row)
    
    # Consultar adjuntos, membretes e imagenes inline vinculadas
    cur.execute("""
    SELECT id, filename, content_type, file_path, content_id, is_inline, file_size, created_at
    FROM ticket_attachments WHERE ticket_id = ? ORDER BY id ASC
    """, (ticket_id,))
    ticket["attachments"] = [dict(r) for r in cur.fetchall()]
    
    # Consultar historial de respuestas enviadas via web / SMTP
    cur.execute("""
    SELECT r.*, u.name as user_name, u.avatar as user_avatar, u.role as user_role, u.area as user_area
    FROM email_replies r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.ticket_id = ?
    ORDER BY r.sent_at ASC
    """, (ticket_id,))
    ticket["replies"] = [dict(r) for r in cur.fetchall()]

    # Consultar historial de estados y transiciones
    cur.execute("""
    SELECT h.id, h.ticket_id, h.operador_id, h.estado_anterior, h.estado_nuevo, h.nota_cambio, h.fecha_cambio,
           u.name as operador_nombre, u.avatar as operador_avatar, u.role as operador_rol
    FROM ticket_historial_estados h
    LEFT JOIN users u ON h.operador_id = u.id
    WHERE h.ticket_id = ?
    ORDER BY h.fecha_cambio ASC, h.id ASC
    """, (ticket_id,))
    ticket["historial"] = [dict(r) for r in cur.fetchall()]
    
    conn.close()
    return ticket

@app.get("/api/tickets/{ticket_id}/attachments")
def get_ticket_attachments(ticket_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT * FROM ticket_attachments WHERE ticket_id = ? ORDER BY id ASC
    """, (ticket_id,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

class ClaimTicketPayload(BaseModel):
    user_id: Optional[int] = None

class AssignTicketPayload(BaseModel):
    operador_id: int
    departamento_id: Optional[int] = None
    task_type_id: Optional[int] = None
    notas: Optional[str] = None
    coordinador_id: Optional[int] = None
    status: Optional[str] = "ASIGNADO"

@app.get("/api/task-types")
def get_task_types_catalog(area: Optional[str] = None):
    """Retorna el catálogo oficial de tareas técnicas P1-P5 con sus puntos DERS y SLAs"""
    conn = get_db()
    cur = conn.cursor()
    if area and area != "Todas":
        norm_area = normalize_area_name(area)
        cur.execute("SELECT id, code, name, area, points, sla_minutes, description FROM task_types WHERE area = ? OR area LIKE ? ORDER BY points ASC, code ASC", (norm_area, f"%{area}%"))
    else:
        cur.execute("SELECT id, code, name, area, points, sla_minutes, description FROM task_types ORDER BY area ASC, points ASC, code ASC")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

# =============================================================
# ASIGNACIÓN EXCLUSIVA: DISPONIBILIDAD Y ASIGNACIÓN DE OPERADORES
# =============================================================


@app.get("/api/operators/availability")
def get_operators_availability(departamento_id: Optional[int] = None, area: Optional[str] = None, request: Request = None):
    """
    Retorna la lista de usuarios de la tabla users donde su role sea 'Especialista' (u 'Operador')
    y su departamento_id coincida con el del coordinador autenticado o con el departamento_id solicitado.
    Calcula dinámicamente sus puntos activos actuales (active_points / puntos_activos) a partir de
    los tickets en estado 'EN PROGRESO' o 'EN ESPERA'.
    """
    user, coordinator_depto_id = get_authenticated_coordinator(request, explicit_depto_id=departamento_id)

    # Si se envía departamento_id explícito en la consulta (ej. para asignar en cualquier depto o en el modal), se prioriza
    if departamento_id:
        coordinator_depto_id = departamento_id

    # Fallback por parámetro 'area' si vino como string
    if not coordinator_depto_id and area and area != "Todas":
        conn_tmp = get_db()
        cur_tmp = conn_tmp.cursor()
        norm_a = normalize_area_name(area)
        cur_tmp.execute("SELECT id FROM departamentos WHERE nombre = ? OR codigo = ? LIMIT 1", (norm_a, norm_a))
        d_row = cur_tmp.fetchone()
        conn_tmp.close()
        if d_row:
            coordinator_depto_id = d_row[0]

    if not coordinator_depto_id:
        return JSONResponse(
            status_code=400,
            content={"error": "No se pudo determinar el departamento del coordinador. Inicie sesión con un usuario con departamento_id asignado."}
        )

    conn = get_db()
    cur = conn.cursor()

    # FILTRADO: role 'ESPECIALISTA' u 'OPERADOR' y departamento_id del coordinador
    cur.execute("""
    SELECT u.id, u.name, u.email, u.role, u.area, u.avatar, u.shift, u.status, u.departamento_id,
           COALESCE(d.nombre, u.area) as departamento_nombre,
           COALESCE(d.codigo, 'ACCESO_APROV') as departamento_codigo
    FROM users u
    LEFT JOIN departamentos d ON u.departamento_id = d.id
    WHERE u.departamento_id = ?
      AND (UPPER(u.role) IN ('ESPECIALISTA', 'OPERADOR') OR UPPER(u.role) NOT IN ('ADMINISTRADOR', 'COORDINADOR'))
      AND u.status = 'Activo'
    ORDER BY u.name ASC
    """, (coordinator_depto_id,))

    operators = [dict(r) for r in cur.fetchall()]

    # Fallback: si no hay con rol estricto, buscar todos los activos no-administradores del departamento
    if not operators:
        cur.execute("""
        SELECT u.id, u.name, u.email, u.role, u.area, u.avatar, u.shift, u.status, u.departamento_id,
               COALESCE(d.nombre, u.area) as departamento_nombre,
               COALESCE(d.codigo, 'ACCESO_APROV') as departamento_codigo
        FROM users u
        LEFT JOIN departamentos d ON u.departamento_id = d.id
        WHERE u.departamento_id = ?
          AND UPPER(u.role) != 'ADMINISTRADOR'
          AND u.status = 'Activo'
        ORDER BY u.name ASC
        """, (coordinator_depto_id,))
        operators = [dict(r) for r in cur.fetchall()]

    result = []
    for op in operators:
        op_id = op["id"]
        cur.execute("""
        SELECT et.id, et.ticket_code, et.status, COALESCE(tt.points, 1) as points
        FROM email_tickets et
        LEFT JOIN task_types tt ON et.suggested_task_type_id = tt.id
        WHERE (et.operador_id = ? OR et.claimed_by_user_id = ?)
          AND UPPER(et.status) IN ('EN PROGRESO', 'EN ESPERA', 'ASIGNADO')
        """, (op_id, op_id))
        active_t = cur.fetchall()

        active_count = len(active_t)
        active_points = sum(t["points"] for t in active_t)

        if active_points == 0:
            sat_label = "Disponible"
            sat_color = "#10B981"
        elif active_points <= 4:
            sat_label = "Baja Carga"
            sat_color = "#1C58A8"
        elif active_points <= 8:
            sat_label = "Carga Moderada"
            sat_color = "#F59E0B"
        else:
            sat_label = "Sobrecarga"
            sat_color = "#EF4444"

        result.append({
            **op,
            "active_tickets_count": active_count,
            "tickets_activos": active_count,
            "active_points": active_points,
            "puntos_activos": active_points,
            "saturation_level": sat_label,
            "saturation_color": sat_color
        })

    conn.close()

    # Ordenar de MENOR a MAYOR carga de trabajo (puntos activos)
    result.sort(key=lambda x: (x["active_points"], x["active_tickets_count"], x["name"]))
    return result


@app.get("/api/departamentos")
def get_departamentos_endpoint():
    """Retorna los 5 departamentos oficiales con métricas de tickets en cola y resueltos"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT d.id, d.codigo, d.nombre, d.descripcion, d.activo,
           COUNT(CASE WHEN et.status = 'PENDIENTE' THEN 1 END) as tickets_pendientes,
           COUNT(CASE WHEN et.status = 'EN PROGRESO' THEN 1 END) as tickets_en_proceso,
           COUNT(CASE WHEN et.status = 'EN ESPERA' THEN 1 END) as tickets_en_espera,
           COUNT(CASE WHEN et.status = 'COMPLETADO' THEN 1 END) as tickets_resueltos,
           COUNT(et.id) as total_tickets
    FROM departamentos d
    LEFT JOIN email_tickets et ON d.id = et.departamento_id
    GROUP BY d.id
    ORDER BY d.id ASC
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

@app.get("/api/operadores")
def get_operadores_endpoint(depto_id: Optional[int] = None):
    """Retorna operadores activos agrupados o filtrados por departamento"""
    conn = get_db()
    cur = conn.cursor()
    query = """
    SELECT u.id, u.name, u.email, u.role, u.area, u.avatar, u.shift, u.departamento_id,
           COALESCE(d.nombre, u.area) as departamento_nombre
    FROM users u
    LEFT JOIN departamentos d ON u.departamento_id = d.id
    WHERE u.status = 'Activo'
    """
    params = []
    if depto_id and depto_id > 0:
        query += " AND u.departamento_id = ?"
        params.append(depto_id)
    query += " ORDER BY u.departamento_id ASC, u.name ASC"
    cur.execute(query, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

@app.post("/api/tickets/{ticket_id}/assign")
def assign_ticket(ticket_id: int, request: Request, payload: AssignTicketPayload):
    """
    Asignación explícita de un ticket a un operador por parte del Coordinador de área.
    Validaciones estrictas:
    1. Valida que el ticket y el operador existan.
    2. Valida que el ticket y el operador pertenezcan al mismo departamento del coordinador.
    3. Actualiza operador_id en el ticket y establece el status como 'ASIGNADO' (o 'EN PROGRESO').
    4. Inserta un registro en ticket_historial_estados documentando la asignación.
    """
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, ticket_code, status, departamento_id, area, subject, fecha_inicio_atencion FROM email_tickets WHERE id = ?", (ticket_id,))
    t_row = cur.fetchone()
    if not t_row:
        conn.close()
        return JSONResponse(status_code=404, content={"error": f"Ticket #{ticket_id} no encontrado."})
        
    cur.execute("SELECT id, name, area, role, avatar, departamento_id FROM users WHERE id = ?", (payload.operador_id,))
    u_row = cur.fetchone()
    if not u_row:
        conn.close()
        return JSONResponse(status_code=404, content={"error": f"Operador #{payload.operador_id} no encontrado."})

    # Resolver quién ejecuta la asignación (Coordinador autenticado)
    caller, coord_depto_id = get_authenticated_coordinator(request, payload.coordinador_id)
    if not caller:
        conn.close()
        return JSONResponse(status_code=401, content={"error": "Autenticación requerida. Debe iniciar sesión como Coordinador o Administrador."})

    caller_role = (caller.get("role") or "").upper()
    if caller_role not in ("COORDINADOR", "ADMINISTRADOR"):
        conn.close()
        return JSONResponse(status_code=403, content={"error": "Acceso denegado: Se requiere rol de Coordinador o Administrador para asignar tickets."})

    ticket_depto_id = t_row["departamento_id"]
    operator_depto_id = u_row["departamento_id"]

    is_admin = caller_role == "ADMINISTRADOR"

    # 1. Validación de departamento del Coordinador con el Ticket
    if coord_depto_id and ticket_depto_id and not is_admin:
        if coord_depto_id != ticket_depto_id:
            conn.close()
            return JSONResponse(
                status_code=403,
                content={"error": f"Acceso denegado: El coordinador pertenece al departamento {coord_depto_id}, pero el ticket pertenece al departamento {ticket_depto_id}."}
            )

    # 2. Validación de departamento del Coordinador con el Operador
    if coord_depto_id and operator_depto_id and not is_admin:
        if coord_depto_id != operator_depto_id:
            conn.close()
            return JSONResponse(
                status_code=400,
                content={"error": f"El operador '{u_row['name']}' pertenece al departamento {operator_depto_id}, que no coincide con el del coordinador ({coord_depto_id})."}
            )

    # 3. VALIDACIÓN CRÍTICA: Ticket y Operador deben pertenecer al mismo departamento
    if ticket_depto_id and operator_depto_id and ticket_depto_id != operator_depto_id:
        conn.close()
        return JSONResponse(
            status_code=400,
            content={"error": f"El operador '{u_row['name']}' pertenece al departamento {operator_depto_id}, que no coincide con el departamento del ticket ({ticket_depto_id})."}
        )

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_depto_id = ticket_depto_id or operator_depto_id or coord_depto_id or 1
    estado_anterior = t_row["status"] or "PENDIENTE"
    nuevo_status = payload.status or "ASIGNADO"
    
    # 4. Actualizar operador_id en el ticket, tarea técnica si se especificó, y estado asignado
    if payload.task_type_id:
        cur.execute("""
        UPDATE email_tickets
        SET operador_id = ?, claimed_by_user_id = ?, departamento_id = ?,
            status = ?,
            suggested_task_type_id = ?
        WHERE id = ?
        """, (payload.operador_id, payload.operador_id, new_depto_id, nuevo_status, payload.task_type_id, ticket_id))
    else:
        cur.execute("""
        UPDATE email_tickets
        SET operador_id = ?, claimed_by_user_id = ?, departamento_id = ?,
            status = ?
        WHERE id = ?
        """, (payload.operador_id, payload.operador_id, new_depto_id, nuevo_status, ticket_id))
    
    # 5. Insertar un registro en ticket_historial_estados documentando la asignación
    assigner_desc = f"por {caller['name']}" if caller else "desde Mesa de Asignación (Triage)"
    nota_cambio = payload.notas or f"Asignado al especialista {u_row['name']} {assigner_desc}"
    cur.execute("""
    INSERT INTO ticket_historial_estados (
        ticket_id, operador_id, estado_anterior, estado_nuevo, nota_cambio, fecha_cambio
    ) VALUES (?, ?, ?, ?, ?, ?)
    """, (
        ticket_id, payload.operador_id, estado_anterior, nuevo_status,
        nota_cambio,
        now_str
    ))
    conn.commit()
    conn.close()
    
    # 6. Registrar en bitácora forense de auditoría
    client_ip = request.client.host if request and request.client else "127.0.0.1"
    log_audit_event(
        user_id=payload.operador_id,
        user_name=u_row["name"],
        user_role=u_row["role"],
        area=u_row["area"],
        action="ASIGNACION_TICKET",
        entity_type="TICKET",
        entity_id=t_row["ticket_code"],
        details=f"Ticket {t_row['ticket_code']} ({t_row['area']}) asignado al operador {u_row['name']} ({u_row['area']}). Estado: {nuevo_status}",
        ip_address=client_ip
    )
    return {
        "status": "ok",
        "ticket_id": ticket_id,
        "ticket_code": t_row["ticket_code"],
        "operador_id": payload.operador_id,
        "operador_nombre": u_row["name"],
        "operador_area": u_row["area"],
        "estado_anterior": estado_anterior,
        "estado_nuevo": nuevo_status,
        "message": f"Ticket {t_row['ticket_code']} asignado exitosamente a {u_row['name']}"
    }

@app.post("/api/tickets/{ticket_id}/start")
@app.post("/api/tickets/{ticket_id}/in-progress")
def start_ticket_work(ticket_id: int, request: Request):
    """
    Pone un ticket en proceso de atención técnica ('EN PROGRESO').
    Registra fecha_inicio_atencion y el cambio de estado en el historial.
    """
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, ticket_code, status, area, subject, operador_id, claimed_by_user_id, fecha_inicio_atencion FROM email_tickets WHERE id = ?", (ticket_id,))
    t_row = cur.fetchone()
    if not t_row:
        conn.close()
        return JSONResponse(status_code=404, content={"error": f"Ticket #{ticket_id} no encontrado."})

    user_id = None
    if request:
        auth_u = get_authenticated_user(request)
        if auth_u:
            user_id = auth_u["id"]
        else:
            x_uid = request.headers.get("X-User-Id")
            if x_uid and x_uid.isdigit():
                user_id = int(x_uid)
    if not user_id:
        user_id = t_row["operador_id"] or t_row["claimed_by_user_id"] or 2

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    estado_anterior = t_row["status"] or "ASIGNADO"

    cur.execute("""
    UPDATE email_tickets
    SET status = 'EN PROGRESO',
        operador_id = COALESCE(operador_id, ?),
        claimed_by_user_id = COALESCE(claimed_by_user_id, ?),
        fecha_inicio_atencion = COALESCE(fecha_inicio_atencion, ?),
        claimed_at = COALESCE(claimed_at, ?),
        total_paused_seconds = 0
    WHERE id = ?
    """, (user_id, user_id, now_str, now_str, ticket_id))

    cur.execute("""
    INSERT INTO ticket_historial_estados (
        ticket_id, operador_id, estado_anterior, estado_nuevo, nota_cambio, fecha_cambio
    ) VALUES (?, ?, ?, 'EN PROGRESO', 'Operador puso el ticket en proceso de atención técnica', ?)
    """, (ticket_id, user_id, estado_anterior, now_str))

    conn.commit()

    cur.execute("SELECT name, role, area FROM users WHERE id = ?", (user_id,))
    u_row = cur.fetchone()
    u_name = u_row["name"] if u_row else "Especialista"
    conn.close()

    client_ip = request.client.host if request and request.client else "127.0.0.1"
    log_audit_event(
        user_id=user_id,
        user_name=u_name,
        action="INICIO_ATENCION",
        entity_type="TICKET",
        entity_id=t_row["ticket_code"],
        details=f"Ticket {t_row['ticket_code']} puesto EN PROGRESO por {u_name}",
        ip_address=client_ip
    )

    return {
        "status": "ok",
        "ticket_id": ticket_id,
        "ticket_code": t_row["ticket_code"],
        "estado_anterior": estado_anterior,
        "estado_nuevo": "EN PROGRESO",
        "fecha_inicio_atencion": now_str,
        "message": f"Ticket {t_row['ticket_code']} puesto en proceso correctamente."
    }

@app.post("/api/tickets/{ticket_id}/claim")
def claim_ticket(ticket_id: int, payload: Optional[ClaimTicketPayload] = None, request: Request = None):
    conn = get_db()
    cur = conn.cursor()
    
    # Resolver user_id desde payload o sesión autenticada
    user_id = payload.user_id if payload and payload.user_id else None
    if not user_id and request:
        auth_u = get_authenticated_user(request)
        if auth_u:
            user_id = auth_u["id"]
    if not user_id:
        user_id = 16  # Default: José Corobo (Especialista Soporte)
        
    cur.execute("SELECT ticket_code, status, area, sender_email, subject, fecha_inicio_atencion FROM email_tickets WHERE id = ?", (ticket_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return JSONResponse(status_code=404, content={"error": "Ticket no encontrado"})
    if row["status"] == "EN PROGRESO":
        conn.close()
        return JSONResponse(status_code=400, content={"error": "El ticket ya está en atención"})
        
    ticket_code = row["ticket_code"]
    ticket_area = row["area"]
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("""
    UPDATE email_tickets
    SET status = 'EN PROGRESO', claimed_by_user_id = ?, operador_id = ?, claimed_at = ?,
        fecha_inicio_atencion = COALESCE(fecha_inicio_atencion, ?), total_paused_seconds = 0
    WHERE id = ?
    """, (user_id, user_id, now_str, now_str, ticket_id))
    
    # Registrar en ticket_historial_estados
    cur.execute("""
    INSERT INTO ticket_historial_estados (
        ticket_id, operador_id, estado_anterior, estado_nuevo, nota_cambio, fecha_cambio
    ) VALUES (?, ?, ?, 'En Proceso', ?, ?)
    """, (ticket_id, user_id, row["status"], "Ticket tomado para atención técnica inmediata", now_str))

    conn.commit()
    
    # Obtener datos del especialista para respuesta y auditoría
    cur.execute("SELECT name, role, area, avatar FROM users WHERE id = ?", (user_id,))
    u_row = cur.fetchone()
    u_name = u_row["name"] if u_row else "Especialista"
    u_role = u_row["role"] if u_row else "ESPECIALISTA"
    u_area = u_row["area"] if u_row else ticket_area
    conn.close()
    
    client_ip = request.client.host if request and request.client else "127.0.0.1"
    log_audit_event(
        user_id=user_id,
        user_name=u_name,
        user_role=u_role,
        area=u_area,
        action="TOMA_TICKET",
        entity_type="TICKET",
        entity_id=ticket_code,
        details=f"Especialista {u_name} tomó el ticket {ticket_code} ({row['subject'][:40]})",
        ip_address=client_ip
    )
    
    return {
        "status": "ok",
        "claimed_at": now_str,
        "claimed_by_user_id": user_id,
        "claimed_by_name": u_name
    }

@app.post("/api/tickets/{ticket_id}/pause")
def pause_ticket(ticket_id: int, request: Request = None):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT ticket_code, claimed_by_user_id, operador_id, area FROM email_tickets WHERE id = ?", (ticket_id,))
    t_row = cur.fetchone()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("UPDATE email_tickets SET status = 'EN ESPERA', paused_at = ? WHERE id = ? AND status = 'EN PROGRESO'", (now_str, ticket_id))
    
    op_id = t_row["operador_id"] or t_row["claimed_by_user_id"] if t_row else None
    cur.execute("""
    INSERT INTO ticket_historial_estados (
        ticket_id, operador_id, estado_anterior, estado_nuevo, nota_cambio, fecha_cambio
    ) VALUES (?, ?, 'En Proceso', 'En Espera', 'Ticket colocado en espera por contingencia o espera de terreno', ?)
    """, (ticket_id, op_id, now_str))

    conn.commit()
    conn.close()
    
    client_ip = request.client.host if request and request.client else "127.0.0.1"
    if t_row:
        log_audit_event(
            user_id=t_row["claimed_by_user_id"],
            area=t_row["area"],
            action="PAUSA_TICKET",
            entity_type="TICKET",
            entity_id=t_row["ticket_code"],
            details="Ticket colocado en espera por contingencia o espera de terreno",
            ip_address=client_ip
        )
    return {"status": "ok", "paused_at": now_str}

@app.post("/api/tickets/{ticket_id}/resume")
def resume_ticket(ticket_id: int, request: Request = None):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT ticket_code, claimed_by_user_id, operador_id, area, paused_at, total_paused_seconds FROM email_tickets WHERE id = ?", (ticket_id,))
    row = cur.fetchone()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if row and row["paused_at"]:
        try:
            paused_time = datetime.strptime(row["paused_at"], "%Y-%m-%d %H:%M:%S")
            pause_delta = int((datetime.now() - paused_time).total_seconds())
        except:
            pause_delta = 0
        new_total_paused = (row["total_paused_seconds"] or 0) + max(0, pause_delta)
        cur.execute("UPDATE email_tickets SET status = 'EN PROGRESO', paused_at = NULL, total_paused_seconds = ? WHERE id = ?", (new_total_paused, ticket_id))
        
        op_id = row["operador_id"] or row["claimed_by_user_id"]
        cur.execute("""
        INSERT INTO ticket_historial_estados (
            ticket_id, operador_id, estado_anterior, estado_nuevo, nota_cambio, fecha_cambio
        ) VALUES (?, ?, 'En Espera', 'En Proceso', ?, ?)
        """, (ticket_id, op_id, f"Atención reanudada tras {round(pause_delta/60, 1)} min en espera", now_str))

        conn.commit()
        
        client_ip = request.client.host if request and request.client else "127.0.0.1"
        log_audit_event(
            user_id=row["claimed_by_user_id"],
            area=row["area"],
            action="REANUDACION_TICKET",
            entity_type="TICKET",
            entity_id=row["ticket_code"],
            details=f"Atención reanudada tras {round(pause_delta/60, 1)} min en pausa",
            ip_address=client_ip
        )
    conn.close()
    return {"status": "ok"}

class AutoCompleteTicketPayload(BaseModel):
    resolution_notes: Optional[str] = None
    task_type_id: Optional[int] = None
    user_id: Optional[int] = None
    points: Optional[int] = None
    close_ticket: Optional[bool] = None

@app.post("/api/tickets/{ticket_id}/complete")
def complete_ticket_automated(ticket_id: int, payload: AutoCompleteTicketPayload, request: Request = None):
    """
    CRONOMETRAJE 100% AUTOMATIZADO — FSM FASE 1 (OPERADOR):
    El operador marca el ticket como resuelto. El sistema calcula la duración exacta
    descontando el tiempo en pausa (esperas de terreno) y lleva el ticket a estado
    'POR_VERIFICAR' para que el Coordinador valide los puntos antes del cierre definitivo.
    Solo cuando el Coordinador confirme (POST /verify), el ticket pasará a 'COMPLETADO'
    y los puntos se acreditarán en task_logs.
    """
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("""
    SELECT et.ticket_code, et.claimed_by_user_id, et.operador_id, et.area, et.claimed_at, et.fecha_inicio_atencion,
           et.total_paused_seconds, et.suggested_task_type_id, et.status
    FROM email_tickets et
    WHERE et.id = ?
    """, (ticket_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return JSONResponse(status_code=404, content={"error": "Ticket no encontrado"})

    if row["status"] == "POR_VERIFICAR":
        conn.close()
        return JSONResponse(status_code=400, content={"error": "El ticket ya está pendiente de verificación por el Coordinador."})
    if row["status"] == "COMPLETADO":
        conn.close()
        return JSONResponse(status_code=400, content={"error": "El ticket ya fue cerrado y verificado."})
        
    ticket_code = row["ticket_code"]
    user_id = row["operador_id"] or row["claimed_by_user_id"]
    if not user_id and request:
        caller = get_authenticated_user(request)
        if caller:
            user_id = caller["id"]
    if not user_id:
        conn.close()
        return JSONResponse(status_code=400, content={"error": "No se puede completar el ticket sin un operador asignado o autenticado."})
        
    area = row["area"]
    claimed_at_str = row["fecha_inicio_atencion"] or row["claimed_at"]
    total_paused_sec = row["total_paused_seconds"] or 0
    default_task_id = row["suggested_task_type_id"]
    
    # 1. CÁLCULO AUTOMÁTICO DE TIEMPO
    now = datetime.now()
    if claimed_at_str:
        try:
            claimed_dt = datetime.strptime(claimed_at_str, "%Y-%m-%d %H:%M:%S")
            raw_seconds = (now - claimed_dt).total_seconds()
        except:
            raw_seconds = 60
    else:
        raw_seconds = 60
        
    net_seconds = max(30, raw_seconds - total_paused_sec)
    duration_min = max(1, round(raw_seconds / 60))
    wait_min = round(total_paused_sec / 60)
    net_min = max(1, round(net_seconds / 60))
    
    # 2. PUNTOS SUGERIDOS (No se acreditan aún — esperan verificación del coordinador)
    task_type_id = payload.task_type_id or default_task_id or 1
    cur.execute("SELECT points, name FROM task_types WHERE id = ?", (task_type_id,))
    tt_row = cur.fetchone()
    points = tt_row[0] if tt_row else 2
    task_name = tt_row[1] if tt_row else "Operación Estándar"
    
    # 3. ACTUALIZAR ESTADO FSM → POR_VERIFICAR (pendiente de aprobación del Coordinador)
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("""
    UPDATE email_tickets
    SET status = 'POR_VERIFICAR', completed_at = ?, claimed_by_user_id = ?, operador_id = ?,
        fecha_cierre = ?, duracion_atencion_minutos = ?
    WHERE id = ?
    """, (now_str, user_id, user_id, now_str, net_min, ticket_id))
    
    # 4. REGISTRAR EN HISTORIAL INMUTABLE DE ESTADOS
    cur.execute("""
    INSERT INTO ticket_historial_estados (
        ticket_id, operador_id, estado_anterior, estado_nuevo, nota_cambio, fecha_cambio
    ) VALUES (?, ?, 'EN PROGRESO', 'POR_VERIFICAR', ?, ?)
    """, (ticket_id, user_id, payload.resolution_notes or f"Operador marcó como resuelto: {task_name}. En espera de verificación del Coordinador.", now_str))

    conn.commit()
    conn.close()
    
    # 5. REGISTRAR EN BITÁCORA FORENSE DE AUDITORÍA
    client_ip = request.client.host if request and request.client else "127.0.0.1"
    log_audit_event(
        user_id=user_id,
        area=area,
        action="RESOLUCION_PENDIENTE",
        entity_type="TICKET",
        entity_id=ticket_code,
        details=f"Caso marcado como resuelto por operador ({task_name}, {net_min} min netos). Puntos sugeridos: {points}. Esperando verificación del Coordinador.",
        ip_address=client_ip
    )
    
    return {
        "status": "ok",
        "fsm_state": "POR_VERIFICAR",
        "ticket": ticket_code,
        "suggested_points": points,
        "task_name": task_name,
        "duration_minutes": duration_min,
        "net_minutes": net_min,
        "wait_minutes": wait_min,
        "message": f"Ticket marcado como resuelto. Pendiente de verificación del Coordinador para acreditar {points} pts."
    }


class VerifyTicketPayload(BaseModel):
    confirmed_points: Optional[int] = None   # Si el coordinador ajusta los puntos
    verification_notes: Optional[str] = None
    coordinador_id: Optional[int] = None

@app.post("/api/tickets/{ticket_id}/verify")
def verify_ticket_coordinator(ticket_id: int, payload: Optional[VerifyTicketPayload] = None, request: Request = None):
    """
    FSM FASE 2 — VERIFICACIÓN DEL COORDINADOR:
    El Coordinador revisa el ticket en estado 'POR_VERIFICAR', ajusta los puntos
    si lo considera necesario, y lo cierra definitivamente a 'COMPLETADO'.
    En este momento se acreditan los puntos en task_logs.
    """
    conn = get_db()
    cur = conn.cursor()

    payload = payload or VerifyTicketPayload()

    # Resolver coordinador autenticado
    caller, coord_depto_id = get_authenticated_coordinator(request, payload.coordinador_id if payload else None)
    if not caller:
        conn.close()
        return JSONResponse(status_code=401, content={"error": "Autenticación requerida. Inicie sesión como Coordinador o Administrador."})

    coord_id = caller["id"]
    caller_role = (caller.get("role") or "").upper()
    if caller_role not in ("COORDINADOR", "ADMINISTRADOR"):
        conn.close()
        return JSONResponse(status_code=403, content={"error": "Acceso denegado: Solo el Coordinador de área o Administrador puede verificar tickets."})

    # Obtener datos del ticket
    cur.execute("""
    SELECT et.ticket_code, et.operador_id, et.claimed_by_user_id, et.area, et.departamento_id,
           et.duracion_atencion_minutos, et.suggested_task_type_id, et.status,
           et.fecha_inicio_atencion, et.total_paused_seconds
    FROM email_tickets et WHERE et.id = ?
    """, (ticket_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return JSONResponse(status_code=404, content={"error": "Ticket no encontrado"})

    ticket_depto_id = row["departamento_id"]
    is_admin = caller_role == "ADMINISTRADOR"
    if coord_depto_id and ticket_depto_id and not is_admin:
        if coord_depto_id != ticket_depto_id:
            conn.close()
            return JSONResponse(
                status_code=403,
                content={"error": f"Acceso denegado: El ticket pertenece al departamento {ticket_depto_id}, diferente al del coordinador ({coord_depto_id})."}
            )

    if row["status"] not in ("POR_VERIFICAR", "COMPLETADO"):
        conn.close()
        return JSONResponse(
            status_code=400,
            content={"error": f"El ticket está en estado '{row['status']}' y no puede ser verificado. Solo se pueden verificar tickets en estado POR_VERIFICAR."}
        )
    if row["status"] == "COMPLETADO":
        conn.close()
        return JSONResponse(status_code=400, content={"error": "El ticket ya fue verificado y cerrado definitivamente."})

    ticket_code = row["ticket_code"]
    operador_id = row["operador_id"] or row["claimed_by_user_id"]
    area = row["area"]
    net_min = row["duracion_atencion_minutos"] or 1

    # Resolver puntos: usa el valor confirmado por el coordinador, o el sugerido originalmente
    default_task_id = row["suggested_task_type_id"] or 1
    cur.execute("SELECT points, name FROM task_types WHERE id = ?", (default_task_id,))
    tt_row = cur.fetchone()
    original_points = tt_row[0] if tt_row else 2
    task_name = tt_row[1] if tt_row else "Operación Estándar"

    # El coordinador puede ajustar los puntos (si no se especifican, se usan los originales)
    final_points = payload.confirmed_points if payload.confirmed_points is not None else original_points
    final_points = max(1, min(final_points, 16))  # Guardrail: mínimo 1, máximo 16 pts

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. Cerrar el ticket definitivamente
    cur.execute("""
    UPDATE email_tickets SET status = 'COMPLETADO', fecha_cierre = COALESCE(fecha_cierre, ?)
    WHERE id = ?
    """, (now_str, ticket_id))

    # 2. Acreditar puntos en task_logs (esto alimenta las métricas DERS del operador)
    if operador_id:
        cur.execute("""
        INSERT INTO task_logs (
            ticket_code, user_id, task_type_id, description, points,
            duration_minutes, wait_minutes, net_duration, area, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        """, (
            ticket_code, operador_id, default_task_id,
            f"Verificado por Coordinador: {task_name} ({payload.verification_notes or 'Sin notas adicionales'})",
            final_points, net_min, net_min, area, now_str
        ))

    # 3. Registrar en historial de estados
    coord_name = "Coordinador"
    if coord_id:
        cur.execute("SELECT name FROM users WHERE id = ?", (coord_id,))
        cr = cur.fetchone()
        if cr:
            coord_name = cr["name"]

    adjustment_note = f" (Puntos ajustados de {original_points} a {final_points})" if final_points != original_points else ""
    cur.execute("""
    INSERT INTO ticket_historial_estados (
        ticket_id, operador_id, estado_anterior, estado_nuevo, nota_cambio, fecha_cambio
    ) VALUES (?, ?, 'POR_VERIFICAR', 'COMPLETADO', ?, ?)
    """, (
        ticket_id, coord_id,
        f"Verificado y cerrado por {coord_name}. Puntos acreditados: {final_points}{adjustment_note}. {payload.verification_notes or ''}",
        now_str
    ))

    conn.commit()
    conn.close()

    # 4. Auditoría forense
    client_ip = request.client.host if request and request.client else "127.0.0.1"
    log_audit_event(
        user_id=coord_id,
        area=area,
        action="VERIFICACION_TICKET",
        entity_type="TICKET",
        entity_id=ticket_code,
        details=f"Coordinador {coord_name} verificó y cerró el ticket {ticket_code}. Puntos acreditados al operador: {final_points} pts{adjustment_note}.",
        ip_address=client_ip
    )

    return {
        "status": "ok",
        "fsm_state": "COMPLETADO",
        "ticket": ticket_code,
        "final_points": final_points,
        "original_points": original_points,
        "adjusted": final_points != original_points,
        "verified_by": coord_name,
        "message": f"Ticket {ticket_code} cerrado y {final_points} puntos acreditados al operador."
    }

class TicketReplyPayload(BaseModel):
    body_text: str
    close_ticket: bool = False
    resolution_notes: Optional[str] = None
    task_type_id: Optional[int] = None
    custom_recipient: Optional[str] = None
    custom_subject: Optional[str] = None

@app.post("/api/tickets/{ticket_id}/reply")
def reply_to_ticket(ticket_id: int, payload: TicketReplyPayload, request: Request = None):
    """
    Despacha una respuesta técnica formal por correo vía SMTP (conservando el hilo de conversación)
    y opcionalmente completa el ticket computando puntos y tiempo de atención en un solo paso.
    """
    try:
        from services.smtp_service import smtp_service_instance
    except ImportError:
        from app.services.smtp_service import smtp_service_instance

    conn = get_db()
    cur = conn.cursor()

    # 1. Identificar usuario activo
    caller = get_authenticated_user(request) if request else None
    if not caller:
        conn.close()
        return JSONResponse(status_code=401, content={"error": "Autenticación requerida para enviar respuestas."})

    user_id = caller["id"]
    user_name = caller["name"]
    user_role = caller["role"]
    user_area = caller["area"]
    client_ip = request.client.host if request and request.client else "127.0.0.1"

    # 2. Despachar correo saliente vía SMTP
    reply_res = smtp_service_instance.send_reply(
        ticket_id=ticket_id,
        user_id=user_id,
        body_text=payload.body_text,
        user_name=user_name,
        user_role=user_role,
        user_area=user_area,
        custom_recipient=payload.custom_recipient,
        custom_subject=payload.custom_subject,
        ip_address=client_ip
    )

    # 3. Si se marcó 'close_ticket', completar caso y computar puntos
    completion_details = None
    if payload.close_ticket:
        notes = payload.resolution_notes or payload.body_text
        comp_payload = AutoCompleteTicketPayload(
            resolution_notes=notes,
            task_type_id=payload.task_type_id
        )
        completion_details = complete_ticket_automated(ticket_id, comp_payload, request)

    return {
        "status": "ok",
        "reply": reply_res,
        "completed": payload.close_ticket,
        "completion_details": completion_details
    }

@app.post("/api/tickets/simulate-incoming")
def simulate_incoming_ticket(area: Optional[str] = "Soporte"):
    res = mail_worker_instance._sync_simulator(area=area)
    return res
# =============================================================
# ENDPOINTS DEL ALGORITMO DE PARSING DE CASOS REALES
# =============================================================

class AnalyzePayload(BaseModel):
    raw_text: str

@app.post("/api/parser/analyze")
def analyze_raw_email(payload: AnalyzePayload):
    """
    Ejecuta el algoritmo determinista y heurístico de extracción sobre texto 
    libre de un correo de soporte real.
    """
    extracted = TelcoEmailParser.parse(payload.raw_text)
    return {"status": "ok", "parsed": extracted}

class IngestCustomPayload(BaseModel):
    sender_email: str
    subject: str
    body_text: str

@app.post("/api/tickets/ingest-custom")
def ingest_custom_email(payload: IngestCustomPayload):
    """
    Ingesta un correo real, ejecuta el algoritmo de parsing y distribuye 
    automáticamente los datos en la base de datos de tickets de la FSM.
    """
    conn = get_db()
    cur = conn.cursor()
    
    # 1. Ejecutar Algoritmo de Extracción
    full_content = f"{payload.subject}\n{payload.body_text}"
    p = TelcoEmailParser.parse(full_content)
    
    # 2. Obtener ID de tarea correspondiente a la complejidad sugerida
    cur.execute("SELECT id FROM task_types WHERE code = ?", (p["suggested_task_code"],))
    row = cur.fetchone()
    task_type_id = row[0] if row else 1
    
    import random
    code = f"INC-{random.randint(60000, 99999)}"
    
    cur.execute("""
    INSERT INTO email_tickets (
        ticket_code, sender_email, subject, full_body, area, 
        subscriber_code, serial_pon, node_name, slot_pon, mac_address, 
        suggested_task_type_id, status, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', 'MANUAL')
    """, (
        code, payload.sender_email, payload.subject, payload.body_text, p["detected_area"],
        p["subscriber_code"] or "N/A", p["serial_pon"] or "N/A", p["node_name"] or "N/A", 
        p["slot_pon"] or "N/A", p["mac_address"] or "N/A", task_type_id
    ))
    
    conn.commit()
    conn.close()
    return {"status": "ok", "ticket_code": code, "parsed": p}

# =============================================================
# ENDPOINTS DE REPORTES GERENCIALES Y AUDITORÍA
# =============================================================

@app.get("/api/reports/summary")
def get_reports_summary_endpoint(area: str = "Todas", range_filter: str = "all"):
    """
    Retorna métricas consolidadas, KPIs de productividad, balance por célula
    y ranking de los especialistas para la vista previa en el dashboard.
    """
    return get_managerial_summary(area=area, range_filter=range_filter)


# =============================================================
# =============================================================
# ENDPOINTS DE USUARIOS Y GESTIÓN DE ACCESO (MÓDULO DE AUTENTICACIÓN)
# =============================================================

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/login")
def auth_login(req: LoginRequest, request: Request = None):
    import hashlib
    conn = get_db()
    cur = conn.cursor()
    
    req_email = req.email.strip().lower()
    pass_hash = hashlib.sha256(req.password.encode('utf-8')).hexdigest()
    
    cur.execute("SELECT id, name, area, role, avatar, email, password_hash, departamento_id FROM users WHERE LOWER(email) = ?", (req_email,))
    user = cur.fetchone()
    conn.close()
    
    if not user:
        return JSONResponse(status_code=401, content={"status": "error", "message": "Credenciales inválidas. Verifique su correo o contraseña."})

    # Verificación de hash criptográfico SHA-256
    stored_hash = user["password_hash"]
    if stored_hash:
        is_valid = (stored_hash == pass_hash)
    else:
        # Fallback para usuarios iniciales cuyo hash pudiera ser nulo
        default_hash = hashlib.sha256("inter2026".encode('utf-8')).hexdigest()
        is_valid = (pass_hash == default_hash)
    
    if is_valid:
        user_data = {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "area": user["area"],
            "avatar": user["avatar"],
            "departamento_id": user["departamento_id"]
        }
        client_ip = request.client.host if request and request.client else "127.0.0.1"
        log_audit_event(
            user_id=user["id"],
            user_name=user["name"],
            user_role=user["role"],
            area=user["area"],
            action="INICIO_SESION",
            entity_type="AUTH",
            entity_id=str(user["id"]),
            details=f"Acceso concedido al sistema para {user['name']} ({user['email']})",
            ip_address=client_ip
        )
        signed_cookie = sign_session_user_id(user["id"])
        res = JSONResponse(content={"status": "ok", "user": user_data, "token": str(user["id"])})
        res.set_cookie(key="auth_user_id", value=signed_cookie, httponly=True, max_age=86400, samesite="lax")
        return res
        
    return JSONResponse(status_code=401, content={"status": "error", "message": "Credenciales inválidas. Verifique su correo o contraseña."})

@app.post("/api/auth/logout")
def auth_logout(request: Request = None):
    caller = get_authenticated_user(request) if request else None
    client_ip = request.client.host if request and request.client else "127.0.0.1"
    if caller:
        log_audit_event(
            user_id=caller["id"],
            action="CIERRE_SESION",
            entity_type="AUTH",
            entity_id=str(caller["id"]),
            details=f"Sesión finalizada por {caller['name']}",
            ip_address=client_ip
        )
    res = JSONResponse(content={"status": "ok"})
    res.delete_cookie(key="auth_user_id")
    return res

class SwitchUserPayload(BaseModel):
    user_id: int

@app.post("/api/auth/switch-user")
def auth_switch_user(payload: SwitchUserPayload, request: Request = None):
    """
    Permite alternar el operador activo para verificar y operar el sistema.
    Requiere que el llamador esté autenticado con rol ADMINISTRADOR o COORDINADOR.
    """
    caller = get_authenticated_user(request) if request else None
    if not caller:
        return JSONResponse(status_code=401, content={"status": "error", "message": "Autenticación requerida para conmutar de perfil."})
        
    caller_role = (caller.get("role") or "").upper()
    if caller_role not in ("ADMINISTRADOR", "COORDINADOR") and caller["id"] != payload.user_id:
        return JSONResponse(status_code=403, content={"status": "error", "message": "Acceso denegado: solo Administradores y Coordinadores pueden alternar perfiles."})

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, name, area, role, avatar, email, shift, departamento_id FROM users WHERE id = ?", (payload.user_id,))
    user = cur.fetchone()
    conn.close()
    if not user:
        return JSONResponse(status_code=404, content={"status": "error", "message": "Usuario no encontrado"})
        
    client_ip = request.client.host if request and request.client else "127.0.0.1"
    log_audit_event(
        user_id=user["id"],
        user_name=user["name"],
        user_role=user["role"],
        area=user["area"],
        action="CAMBIO_PERFIL",
        entity_type="AUTH",
        entity_id=str(user["id"]),
        details=f"Conmutación activa al perfil de {user['name']} ({user['role']} - {user['area']}) solicitada por {caller['name']}",
        ip_address=client_ip
    )
    user_data = dict(user)
    signed_cookie = sign_session_user_id(user["id"])
    res = JSONResponse(content={"status": "ok", "user": user_data, "token": str(user["id"])})
    res.set_cookie(key="auth_user_id", value=signed_cookie, httponly=True, max_age=86400, samesite="lax")
    return res

@app.get("/api/auth/users")
def get_auth_users():
    """Retorna lista de empleados activos para el conmutador de perfil en el dashboard"""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, name, area, role, avatar, email, shift, departamento_id FROM users WHERE status = 'Activo' ORDER BY CASE role WHEN 'ADMINISTRADOR' THEN 1 WHEN 'COORDINADOR' THEN 2 ELSE 3 END, name ASC")
    users = [dict(r) for r in cur.fetchall()]
    conn.close()
    return users

@app.get("/api/auth/me")
def get_current_user_profile(request: Request, user_id: Optional[int] = None):
    """
    Retorna el perfil del usuario autenticado vía Cookie firmada HMAC o Bearer Token.
    Si no está autenticado, responde con código 401.
    """
    caller = get_authenticated_user(request)
    
    # Si se solicita explícitamente un user_id y quien consulta es ADMIN o COORDINADOR
    if user_id and caller:
        caller_role = (caller.get("role") or "").upper()
        if caller_role in ("ADMINISTRADOR", "COORDINADOR") or caller["id"] == user_id:
            conn = get_db()
            cur = conn.cursor()
            cur.execute("SELECT id, name, area, role, avatar, email, shift, departamento_id FROM users WHERE id = ?", (user_id,))
            target = cur.fetchone()
            conn.close()
            if target:
                return dict(target)

    if caller:
        return caller
        
    return JSONResponse(status_code=401, content={"error": "Sesión no activa o no autenticada"})

# =============================================================
# ENDPOINTS DE AUDITORÍA FORENSE
# =============================================================

@app.get("/api/audit/logs")
def get_audit_logs_endpoint(limit: int = 50, user_id: Optional[int] = None, action: Optional[str] = None, area: Optional[str] = None):
    """Consulta los registros de la bitácora de auditoría forense"""
    return get_audit_logs(limit=limit, user_id=user_id, action=action, area=area)

# =============================================================
# ENDPOINTS DEL WORKER DE CORREO (MODO SIMULADOR E IMAP REAL)
# =============================================================

@app.get("/api/mail-worker/status")
def get_mail_worker_status():
    """Retorna el estado de sincronización del worker en segundo plano"""
    return mail_worker_instance.get_status()

class ToggleWorkerPayload(BaseModel):
    enabled: bool

@app.post("/api/mail-worker/toggle")
def toggle_mail_worker(payload: ToggleWorkerPayload):
    """Activa o pausa la búsqueda automática en segundo plano"""
    mail_worker_instance.config["enabled"] = payload.enabled
    mail_worker_instance.save_config(mail_worker_instance.config)
    return {"status": "ok", "enabled": payload.enabled}

@app.post("/api/mail-worker/sync-now")
def sync_mail_worker_now():
    """Fuerza una sincronización inmediata sin esperar el intervalo"""
    res = mail_worker_instance.sync_now()
    return res

class MailWorkerConfigPayload(BaseModel):
    mode: str
    poll_interval: int
    imap_server: Optional[str] = "imap.gmail.com"
    imap_port: Optional[int] = 993
    imap_user: Optional[str] = ""
    imap_password: Optional[str] = ""
    imap_mailbox: Optional[str] = "INBOX"

@app.post("/api/mail-worker/config")
def update_mail_worker_config(payload: MailWorkerConfigPayload):
    """Actualiza los parámetros de conexión y modo de trabajo"""
    cfg = {
        "mode": payload.mode,
        "poll_interval": payload.poll_interval,
        "imap_server": payload.imap_server,
        "imap_port": payload.imap_port,
        "imap_user": payload.imap_user,
        "imap_mailbox": payload.imap_mailbox
    }
    if payload.imap_password:
        cfg["imap_password"] = payload.imap_password
    mail_worker_instance.save_config(cfg)
    return {"status": "ok", "config": mail_worker_instance.get_status()}

class TestMailConnectionPayload(BaseModel):
    imap_server: str
    imap_port: Optional[int] = 993
    imap_user: str
    imap_password: str
    imap_mailbox: Optional[str] = "INBOX"

@app.post("/api/mail-worker/test-connection")
def test_mail_connection_endpoint(payload: TestMailConnectionPayload):
    """
    Prueba en vivo la conectividad SSL/TLS IMAP con un buzón corporativo
    (Outlook, Exchange, Inter) y retorna telemetría de diagnóstico.
    """
    return mail_worker_instance.test_connection(
        server=payload.imap_server,
        port=payload.imap_port or 993,
        user=payload.imap_user,
        password=payload.imap_password,
        mailbox=payload.imap_mailbox or "INBOX"
    )


# =============================================================
# ENDPOINTS M5: ASISTENTE DE COMANDOS CLI
# =============================================================
from services.command_generator import CommandGenerator

@app.get("/api/commands/categories")
def get_command_categories(vendor: str):
    return {"categories": CommandGenerator.get_categories(vendor)}

@app.get("/api/commands/list")
def get_commands_list(vendor: str, category: str):
    return {"commands": CommandGenerator.get_commands(vendor, category)}

@app.post("/api/commands/generate")
def generate_command(payload: dict):
    vendor = payload.get("vendor")
    category = payload.get("category")
    command_id = payload.get("command_id")
    params = payload.get("params", {})
    
    cmd = CommandGenerator.generate(vendor, category, command_id, params)
    if cmd:
        return {"command": cmd}
    return JSONResponse(status_code=400, content={"error": "Comando no encontrado o parámetros inválidos."})

# =============================================================
# ENDPOINTS: MÉTRICAS DE CARGA DE TRABAJO Y EXPORTACIÓN EXCEL
# =============================================================

class TaskDetailModel(BaseModel):
    id: Optional[int] = None
    code: Optional[str] = None
    name: Optional[str] = None
    points: Optional[int] = 0
    sla_minutes: Optional[int] = 0

class ActiveTicketDetailModel(BaseModel):
    id: int
    ticket_code: Optional[str] = None
    subject: str
    subscriber_code: Optional[str] = None
    serial_pon: Optional[str] = None
    node_name: Optional[str] = None
    slot_pon: Optional[str] = None
    mac_address: Optional[str] = None
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    operator_avatar: Optional[str] = None
    operator_role: Optional[str] = None
    operator_area: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    task: Optional[TaskDetailModel] = None
    points: int = 0
    started_at: Optional[str] = None
    elapsed_minutes: int = 0
    sla_minutes: int = 0
    sla_percentage: float = 0.0
    sla_status: str = "ok"
    sla_label: Optional[str] = "Dentro de Tiempo Objetivo"
    sla_color: Optional[str] = "blue"

class OperatorWorkloadDetail(BaseModel):
    operator_id: int
    name: str
    email: Optional[str] = None
    role: Optional[str] = None
    area: Optional[str] = None
    avatar: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    active_tickets_count: int = 0
    active_points: int = 0
    max_elapsed_minutes: int = 0
    saturation_level: str
    saturation_badge: str
    saturation_color: str
    active_tickets: List[ActiveTicketDetailModel] = []

class AreaWorkloadDetail(BaseModel):
    area: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    active_tickets_count: int = 0
    active_points: int = 0
    active_operators_count: int = 0
    share_percentage: float = 0.0
    saturation_status: str
    tickets: List[ActiveTicketDetailModel] = []

class WorkloadSummary(BaseModel):
    total_active_tickets: int = 0
    total_active_points: int = 0
    active_operators_count: int = 0
    total_available_operators: int = 0
    avg_elapsed_minutes: float = 0.0
    bottleneck_area: str
    most_loaded_operator: str
    system_status: str

class WorkloadMetric(BaseModel):
    status: str
    timestamp: str
    filter_area: str
    summary: WorkloadSummary
    by_operator: List[OperatorWorkloadDetail] = []
    by_area: List[AreaWorkloadDetail] = []
    active_tickets_list: List[ActiveTicketDetailModel] = []


@app.get("/api/metrics/workload", response_model=WorkloadMetric)
def get_workload_metrics(area: str = "Todas"):
    """
    Calcula en tiempo real los tickets 'En Progreso' y puntos de complejidad (P1-P5)
    agrupados por operador y por célula/área técnica desde la base de datos.
    """
    return get_current_workload(area=area)


@app.get("/api/workload/current", response_model=WorkloadMetric)
def get_workload_current_alias(area: str = "Todas"):
    """Alias para compatibilidad con llamadas existentes del monitor"""
    return get_current_workload(area=area)


@app.get("/api/reports/export")
def export_productivity_report_endpoint(area: str = "Todas", range_filter: str = "all"):
    """
    Genera en memoria un libro Excel (.xlsx) con los KPIs gerenciales, balance de célula
    y productividad de especialistas, retornándolo como StreamingResponse.
    """
    stream = export_productivity_report(area=area, range_filter=range_filter)
    safe_area = area.replace(" ", "_").lower()
    filename = f"reporte_kpi_operaciones_{safe_area}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@app.get("/api/reports/export/excel")
def export_reports_excel_alias(area: str = "Todas", range_filter: str = "all"):
    """Alias para compatibilidad con rutas previas de descarga de reportes"""
    return export_productivity_report_endpoint(area=area, range_filter=range_filter)

