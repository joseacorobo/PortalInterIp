# Operaciones IP — Plataforma de Gestión de Carga, Métricas DERS y Automatización FSM

Sistema web integral de gestión operativa, balanceo de carga de trabajo, medición de KPIs bajo estándar DERS, ingesta automatizada de correos y trazabilidad forense para el departamento de **Operaciones IP** de **Inter Telecomunicaciones C.A.** (Red FTTH).

---

## 1. Arquitectura y Jerarquía Organizacional

La plataforma modela la estructura jerárquica de la empresa y soporta asignación dinámica de personal:

- **Departamento General:** Operaciones IP
  - **1. Redes de Acceso y Aprovisionamiento:** Diagnóstico ONT/FTTH, validación de aprovisionamiento, modo bridge, cabecera OLT.
  - **2. Control de Tráfico y Redes Inalámbricas:** QoS, enlaces inalámbricos, balanceo de carga.
  - **3. Seguridad Perimetral:** Firewalls, mitigación DDoS, VPNs y políticas perimetrales.
  - **4. Telefonía VoIP / SIP:** Aprovisionamiento de líneas, servidores SIP, dialplans, métricas MOS y jitter.
  - **5. Redes WAN & Core:** Enrutamiento BGP, transporte de datos, backhaul y troncales IP nacionales.
  - **6. Grandes Clientes:** Clientes corporativos, enlaces dedicados y acuerdos de nivel de servicio (SLA) preferenciales.

---

## 2. Módulos y Funcionalidades Principales

### Portal de Autenticación Corporativo (login.html)
- **Diseño NOC Dark-Space:**
  - Fondo espacial oscuro con simulación de malla de red 3D de nodos interactivos en HTML5 Canvas.
  - Tarjeta de credenciales con efecto glassmorphism, selector rápido para demos y botón de acceso seguro.
  - Manejo de sesiones mediante cookie HTTP-Only firmada con HMAC (`auth_user_id`).
  - Acceso directo para **Administrador General** (`admin@inter.com.ve` / clave `inter2026`) y **Coordinadores**.

### Sidebar Institucional y Torre de Control (Stitch NOC)
- **Navegación Plegable (17.5rem a 4.75rem):**
  - Acordeón de departamentos con chevron giratorio e insignias de conteo en vivo.
  - Tarjeta de sesión activa del ingeniero/coordinador (nombre, rol, iniciales y departamento).
  - Conmutador de vista operativa, rendimiento y auditoría forense.

### Tablero de Gestión Operativa (dashboard.html)
- **ScoreCards de Telemetría en Tiempo Real:**
  - Estado de la cola global (pendientes, en progreso, en espera), casos críticos (P4/P5, Bridge) y SLA.
- **Torre del Especialista y Mesa de Asignación:**
  - Vista exclusiva para Coordinadores: Triage de tickets pendientes con asignación balanceada según saturación.
  - Vista de Especialista: Mis tareas activas, cronómetro en vivo, botón de pausa técnica y resolución asistida.
- **Auditoría Forense y Exportación:**
  - Bitácora inmutable con sellado de tiempo y dirección IP.
  - Generación de reportes ejecutivos en formato Excel (.xlsx vía streaming).

### Motor de Métricas y Ponderación por Puntos (DERS)
- Asignación de puntos ponderados según la complejidad técnica de la tarea:
  - **P1 (1 pt):** Verificación de estado de ONT en OLT / Consultas simples.
  - **P2 (2 pts):** Resolución de discrepancia MAC / Pruebas de velocidad.
  - **P3 (3 pts):** Desatasco de demonio OLT (VLAN / Whitelist) / Sustitución SFP.
  - **P4 (5 pts):** Soporte a Modo Bridge con IP Certificada / Diagnóstico Jitter & MOS VoIP.
  - **P5 (8 pts):** Habilitación PortChannel 10G a 20G / Contingencias troncales.
- Medición de saturación individual y velocímetro de balance del área (Equilibrada, Moderada, Alta).
- Gráficos interactivos en tiempo real con Chart.js (curvas horarias spline y gráficos de distribución por complejidad).

### Workspace de Atención y Cronometraje 100% Automatizado FSM
- **Cero ingreso manual de tiempos:** Al abrir un correo (*Atender*), el backend registra la marca temporal de inicio (`claimed_at = now()`) e inicia un cronómetro en vivo (`HH:MM:SS`).
- **Botón de Pausa (En Espera de Terreno):** Permite pausar el ticket si la cuadrilla debe verificar acometida o drop. El tiempo transcurrido en pausa se descuenta automáticamente del MTTR neto.
- **Bloqueo Concurrente FSM:** Impide que dos ingenieros tomen el mismo ticket de forma simultánea.

### Algoritmo de Extracción Telco (TelcoEmailParser)
Procesamiento heurístico y determinista de correos de soporte sin dependencias de servicios externos ni consumo de APIs de pago:
- **Número de Abonado (10 Dígitos):** Extrae el contrato y detecta de inmediato el **Permisor** asociado (primeros 2 dígitos, ej. `P-10`, `P-25`).
- **Serial PON (12 Caracteres):** Discrimina el fabricante y la topología técnica:
  - `FHTT...` -> FiberHome (Red Inter)
  - `HWTC...` -> Huawei (Red Netuno)
  - `STV...` / Otros -> SimpleTV / Terceros
- **Nombre Canónico de OLT:** Normaliza variantes en texto libre (`OLT CCS 01`, `OLT VAL 02`) al formato canónico `OLT-CCS-01`.
- **Posición OLT:** Si el correo no especifica Slot/PON, asigna inteligentemente: *"Consultar en OLT vía Serial PON"*.
- **Alerta de Seguridad en Modo Bridge:** Al identificar peticiones de IP Certificada o Bridge, emite una alerta crítica que prohíbe comandos de refresco o reaprovisionamiento.

### Módulo de Reportes Gerenciales y Auditoría Forense (Excel)
- Panel de supervisión interactivo con filtros temporales (*Todo, Mes Actual, Últimos 7d, Hoy*) y selectores por célula.
- **Exportación en 1 clic a Excel (.xlsx)** mediante `openpyxl` con 3 pestañas profesionales estructuradas:
  1. *Resumen Ejecutivo y Células:* KPIs consolidados, volumen de horas trabajadas y semáforo de saturación.
  2. *Productividad Especialistas:* Detalle individual con volumen de tickets, puntos totales, MTTR y desglose P1-P5.
  3. *Log Detallado de Auditoría:* Registro forense ticket por ticket con tiempos brutos, pausas, tiempos netos, datos de red (Abonado, Permisor, Serial, OLT, MAC) y notas de diagnóstico.

### Worker de Ingesta en Segundo Plano (IMAP / Simulador)
- **Modo Simulador de Laboratorio:** Genera casos de prueba sintéticos con datos 100% compatibles con la red Inter.
- **Modo IMAP SSL Real:** Conexión segura por puerto 993 para lectura desatendida de bandejas de soporte.
- **Idempotencia Absoluta:** Control de duplicados por encabezado RFC 2822 `Message-ID`.

---

## 3. Estructura del Proyecto

```text
├── app/
│   ├── main.py                  # API FastAPI, rutas de autenticación y endpoints de vistas
│   ├── database.py              # Inicialización SQLite y conexión
│   ├── seed.py                  # Poblador de datos de prueba (ingenieros, tickets, catálogo DERS)
│   ├── services/
│   │   ├── email_parser.py      # Algoritmo de extracción de entidades técnicas
│   │   ├── reports.py           # Agregación de métricas y generador Excel multi-hoja
│   │   └── mail_worker.py       # Worker de sincronización IMAP y simulador de laboratorio
│   ├── static/
│   │   ├── css/snow_ui.css      # Tokens de diseño y variables CSS
│   │   ├── js/dashboard.js      # Controlador de dashboard, bandeja Outlook y cronómetros FSM
│   │   └── img/
│   │       ├── inter_logo.png   # Logotipo oficial de Inter
│   │       └── datacenter_bg.jpg# Fondo técnico del datacenter
│   └── templates/
│       ├── dashboard.html       # Dashboard gerencial, modal de workspace y bandeja Outlook 365
│       └── login.html           # Portal de inicio de sesión (login-operaciones-ip-combinado)
├── Documentación/               # Esquemas de red, capacitaciones FTTH y matrices DERS
├── requirements.txt             # Dependencias del proyecto
├── ROADMAP_Y_CONTROL_MODULOS.md # Bitácora técnica y estado de componentes
└── README.md                    # Documentación técnica del proyecto
```

---

## 4. Instalación y Puesta en Marcha

### Prerrequisitos
- Python 3.10 o superior.
- Git instalado.

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/joseacorobo/PrototipoWeb_OperacionesIP.git
cd PrototipoWeb_OperacionesIP
```

### Paso 2: Crear y Activar Entorno Virtual (Recomendado)
```bash
# En Windows:
python -m venv venv
venv\Scripts\activate

# En Linux / macOS:
python3 -m venv venv
source venv/bin/activate
```

### Paso 3: Instalar Dependencias
```bash
pip install -r requirements.txt
```

### Paso 4: Inicializar y Poblar la Base de Datos
```bash
python app/seed.py
```

### Paso 5: Iniciar el Servidor de Aplicación
```bash
py -m uvicorn main:app --app-dir app --host 0.0.0.0 --port 8000
```

Acceso al sistema en el navegador web:
- **URL:** http://localhost:8000/login
- **Usuario Administrador:** `admin@inter.com.ve`
- **Contraseña:** `admin`

---

## 5. Especialistas del Sistema

| Célula / Área | Especialistas Registrados | Rol Funcional |
| :--- | :--- | :--- |
| **Administración General** | Administrador General (AD) | Auditoría global y supervisión técnica |
| **Soporte FTTH** | Carlos Méndez (CM), Ana Silva (AS), Roberto Gómez (RG), Laura Peña (LP) | Diagnóstico ONT, Whitelist, Demonios, Bridging |
| **Cabecera OLT** | Manuel Torres (MT), Diego Ramos (DR), Patricia Castro (PC), Javier Morales (JM) | Enlaces troncales, SFP, PortChannels 20G |
| **Telefonía VoIP** | Sofía Rivas (SR), Andrés Blanco (AB), Elena Pardo (EP), Gabriel Marcano (GM) | Servidores SIP, Dialplans, MOS y Jitter |

---

## 6. Confidencialidad
Desarrollado para uso exclusivo del departamento de **Operaciones IP — Inter Telecomunicaciones C.A.** Todos los derechos reservados.
