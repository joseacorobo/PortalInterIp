# Portal Operaciones IP — Inter Telecomunicaciones C.A.

Sistema web integral de gestion operativa, balanceo de carga, metricas DERS y automatizacion FSM para el departamento de **Operaciones IP** de Inter (Red FTTH).

## Estructura del Proyecto

```
PortalInterIp/
├── app/                        # Código fuente (FastAPI + Jinja2)
│   ├── main.py                 # Rutas del API y endpoints canónicos (FastAPI)
│   ├── database.py             # Capa de datos SQLite / MySQL
│   ├── seed.py                 # Datos semilla (22 usuarios RBAC, 6 departamentos)
│   ├── services/
│   │   ├── audit.py            # Auditoría forense inmutable
│   │   ├── email_parser.py     # TelcoEmailParser heurístico (M3)
│   │   ├── mail_worker.py      # Worker IMAP en segundo plano (M6)
│   │   ├── reports.py          # Exportación Excel openpyxl (M4)
│   │   └── smtp_service.py     # Notificaciones SMTP
│   ├── static/
│   │   ├── styles/             # Hojas de estilo modulares (Telecom Precision Analytics)
│   │   │   ├── theme_tokens.css        # Tokens corporativos y dark/light mode
│   │   │   ├── sidebar_navigation.css  # Layout y navegación colapsable
│   │   │   ├── dashboard_layout.css    # Grid 12 columnas, KPI cards, animaciones
│   │   │   ├── snow_ui.css             # Primitivas visuales y badges DERS
│   │   │   ├── login_auth.css          # Escena 3D canvas y login corporativo
│   │   │   ├── main.css                # Punto de entrada maestro CSS
│   │   │   └── README.md               # Catálogo y manifiesto de estilos
│   │   ├── css/                # Wrappers de retrocompatibilidad (@import ../styles/)
│   │   ├── js/
│   │   │   ├── dashboard.js    # Lógica de vistas, cola, FSM y telemetría
│   │   │   └── theme.js        # Toggle claro/oscuro (localStorage)
│   │   └── img/
│   │       ├── inter_logo.png  # Logo oficial Inter
│   │       ├── datacenter_bg.jpg
│   │       └── hub_bg.jpg
│   └── templates/
│       ├── login.html          # Portal de autenticación con malla 3D
│       ├── dashboard.html      # Dashboard operativo y analítica Stitch
│       └── partials/
│           ├── sidebar.html    # Menú lateral dinámico y perfil
│           └── asistente_comandos.html # Asistente CLI OLT/Switch
├── docs/                       # Documentación técnica y especificaciones
│   ├── README.md               # Arquitectura y manual del sistema
│   ├── ROADMAP_Y_CONTROL_MODULOS.md # Control de módulos y FSM
│   ├── GUIA_DESPLIEGUE_WEB_SERVER.md # Despliegue en Render y Docker
│   ├── especificaciones_telco.md # Estándares y heurística de red
│   ├── reporte_coordinacion.md # Torre de control y FSM en 2 fases
│   ├── schema_mysql_tickets_ip.sql # Esquema relacional de producción
│   ├── Rules.txt               # Reglas de desarrollo del proyecto
│   └── reglas_agente.md        # Políticas de ejecución del agente
├── infra/                      # Despliegue e infraestructura
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── render.yaml
│   ├── requirements.txt
│   └── Procfile
├── tests/                      # Suite de pruebas automatizadas
│   └── test_endpoints.py       # Validación de endpoints, RBAC, FSM y Excel
├── .stitch/                    # Sistema de diseño Stitch
│   ├── DESIGN.md               # Tokens y diseño Telecom Precision Analytics
│   ├── standalone.html         # Mockup interactivo standalone
│   └── stitch_theme.json       # Tokens exportables en JSON
├── requirements.txt            # Dependencias del proyecto
└── run_server.bat              # Script de inicio rápido local
```

## Módulos del Sistema

| # | Módulo | Estado |
|:-:|:---|:---:|
| M1 | Motor de Métricas DERS | ✅ APROBADO |
| M2 | Workspace FSM y Cronometraje en Vivo | ✅ APROBADO |
| M3 | TelcoEmailParser (Extracción de Entidades) | ✅ APROBADO |
| M4 | Reportes Excel y Auditoría Forense | ✅ APROBADO |
| M5 | Asistente de Comandos CLI | ⏸️ PAUSADO |
| M6 | Worker IMAP (Ingesta de Casos) | ✅ APROBADO |
| M7 | Autenticación RBAC y Sesiones HMAC | ✅ APROBADO |
| M8 | Sidebar Dinámico y Tablero Stitch NOC | ✅ APROBADO |
| M9 | Grandes Clientes y Operaciones WAN | 📋 PLANIFICADO |

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
