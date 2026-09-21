# Portal Operaciones IP — Inter Telecomunicaciones C.A.

Sistema web integral de gestion operativa, balanceo de carga, metricas DERS y automatizacion FSM para el departamento de **Operaciones IP** de Inter (Red FTTH).

## Estructura del Proyecto

```
PortalInterIp/
├── app/                        # Codigo fuente (FastAPI + Jinja2)
│   ├── main.py                 # Todas las rutas del API (FastAPI)
│   ├── database.py             # Modelos SQLite
│   ├── seed.py                 # Datos semilla / usuarios RBAC
│   ├── services/
│   │   ├── audit.py            # Auditoria forense
│   │   ├── email_parser.py     # TelcoEmailParser (M3)
│   │   ├── mail_worker.py      # Worker IMAP (M6)
│   │   ├── reports.py          # Exportacion Excel (M4)
│   │   └── smtp_service.py     # Servicio SMTP
│   ├── static/
│   │   ├── css/
│   │   │   ├── snow_ui.css     # Design tokens y estilos principales
│   │   │   ├── dashboard.css   # Estilos del dashboard
│   │   │   └── sidebar.css     # Estilos del sidebar
│   │   ├── js/
│   │   │   ├── dashboard.js    # Logica de vistas, cola, metricas
│   │   │   └── theme.js        # Toggle claro/oscuro (localStorage)
│   │   └── img/
│   │       ├── inter_logo.png  # Logo oficial Inter
│   │       ├── datacenter_bg.jpg
│   │       └── hub_bg.jpg
│   └── templates/
│       ├── login.html          # Portal de autenticacion
│       ├── dashboard.html      # Dashboard principal (operativo + metricas)
│       ├── mail.html           # Bandeja de correos estilo Outlook
│       └── partials/
│           └── sidebar.html    # Sidebar extraido como partial (PENDIENTE)
├── docs/                       # Documentacion tecnica
│   ├── README.md
│   ├── ROADMAP_Y_CONTROL_MODULOS.md
│   ├── GUIA_DESPLIEGUE_WEB_SERVER.md
│   └── Especificaciones_Tecnicas.txt
├── infra/                      # Despliegue
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── render.yaml
│   ├── requirements.txt
│   └── Procfile
├── stitch_designs/             # Exportaciones/capturas del proyecto Stitch
├── Spec_Implementacion_Antigravity.md   # Brief para el agente
└── Propuesta_Portal_Operaciones_IP.pdf  # Propuesta original
```

## Modulos del Sistema

| # | Modulo | Estado |
|:-:|:---|:---:|
| M1 | Motor de Metricas DERS | ✅ APROBADO |
| M2 | Workspace FSM y Cronometraje | ✅ APROBADO |
| M3 | TelcoEmailParser (extraccion entidades) | ✅ APROBADO |
| M4 | Reportes Excel y Auditoria | ✅ APROBADO |
| M5 | Asistente de Comandos CLI | ⏸️ PAUSADO |
| M6 | Worker IMAP (ingesta correos) | ✅ APROBADO |
| M7 | Autenticacion RBAC y Sesiones | ✅ APROBADO |
| M8 | Sidebar Dinamico y Bandeja Outlook | ✅ APROBADO |
| M9 | Grandes Cuentas y WAN | 📋 PLANIFICADO |

## Inicio Rapido

```bash
cd app
pip install -r ../infra/requirements.txt
python seed.py          # Carga datos iniciales
uvicorn main:app --reload --port 8000
```

Acceder a `http://localhost:8000`
- Admin: `admin@inter.com.ve` / `admin`

## Tokens de Diseno (snow_ui.css)

- Azul `#1C58A8` → normal / brand
- Amarillo `#F4B400` → atencion / moderado  
- Azul marino `#0B3B78` → alto / critico
- **Nunca rojo ni verde** para severidad
