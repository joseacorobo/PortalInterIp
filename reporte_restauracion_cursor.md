# Reporte de Restauración — Portal Operaciones IP (Cursor)

**Fecha:** 23 de septiembre de 2026  
**Alcance:** Reconexión de lógica dinámica (Jinja2, DOM, JavaScript) sobre el diseño Stitch/Tailwind sin alterar clases ni estructura visual principal.

---

## 1. Resumen ejecutivo

Se restauró el enlace entre el caparazón visual de `dashboard.html` y el backend FastAPI existente, cargando de nuevo `app/static/js/dashboard.js` como motor de negocio. El dashboard vuelve a renderizarse con **Jinja2** (usuario de sesión en sidebar/header) y los flujos de **Coordinador (triage/asignación)** y **Operador (mis tareas / poner en proceso / resolver)** quedan operativos vía API.

---

## 2. Fase 1 — Reconexión primordial

### 2.1 Backend (`app/main.py`)

| Cambio | Detalle |
|--------|---------|
| **Jinja2Templates** | Ruta `GET /` pasa de `FileResponse` estático a `TemplateResponse("dashboard.html", { current_user })`. |
| **`resolve_dashboard_user()`** | Resuelve usuario por cookie `auth_user_id`, con fallback a coordinador / José Corobo. |

Endpoints consumidos por el frontend (sin cambios de contrato):

- `GET /api/auth/me`, `GET /api/auth/users`, `POST /api/auth/switch-user`, `POST /api/auth/logout`
- `GET /api/tickets/unassigned`
- `GET /api/tickets/my-assignments`
- `GET /api/operators/availability`
- `POST /api/tickets/{id}/assign`
- `POST /api/tickets/{id}/start` (Poner en Proceso)
- `POST /api/tickets/{id}/pause`, `POST /api/tickets/{id}/resume`
- `POST /api/tickets/{id}/complete`
- `GET /api/kpis`, `GET /api/metrics/workload`, `GET /api/audit/logs`

### 2.2 Jinja2 en `dashboard.html`

| Ubicación | Variables |
|-----------|-----------|
| `#sidebar-user-avatar`, `#sidebar-user-name`, `#sidebar-user-role` | `{{ current_user.avatar }}`, `{{ current_user.name }}`, `{{ current_user.role }} · {{ current_user.area }}` |
| Header perfil (SSR inicial) | Mismos datos + `{% if current_user %}` |
| `#queue-empty-state` | Mensaje condicional si `current_user.role == 'COORDINADOR'` |

La sesión activa se **refresca en cliente** con `/api/auth/me` (cookie).

### 2.3 IDs y contenedores reconectados

| ID / contenedor | Rol |
|-----------------|-----|
| `#coordinator-triage-panel` | Panel Mesa de Asignación (visible solo COORDINADOR/ADMIN) |
| `#triage-tickets-tbody`, `#triage-table-container`, `#triage-empty-state` | Tabla triage + empty state |
| `#triage-count-label`, `#triage-area-badge`, `#icon-refresh-triage` | Metadatos coordinador |
| `#select-operator-{ticketId}`, `#btn-assign-{ticketId}`, `data-ticket-id` | Asignación por fila |
| `#operator-assignments-panel`, `#operator-assignments-list` | Torre del operador |
| `#operator-empty-assignments`, `#operator-empty-title`, `#operator-empty-desc` | Empty state operador |
| `#optab-*`, `#count-optab-*`, `#operator-task-search` | Filtros de tareas |
| `#btn-process-{ticketId}` | Poner en Proceso (render dinámico en JS) |
| `#ticket-table-rows`, `#queue-empty-state`, `#queue-badge-count` | Cola tablero tickets |
| `#user-profile-dropdown`, `#dropdown-users-list`, `#header-user-*` | Conmutador de perfil |
| `#toast-container` | Toasts corporativos (dashboard.js) |
| `#audit-logs-tbody` | Bitácora (alias en JS: `audit-tbody` \|\| `audit-logs-tbody`) |
| `#active-operators-grid`, `#operators-grid-cards` | Destino alterno de carga en vivo (`renderCurrentWorkload`) |

### 2.4 JavaScript (`dashboard.js`)

- **Carga del script:** `<script src="/static/js/dashboard.js">` + puente `stitchDashboardBridge` que fusiona pestañas Stitch (`tickets`, `inbox`, `configuracion`) con `switchDashboardTab` del core.
- **`loadCoordinatorTriage()`** → `/api/operators/availability` + `/api/tickets/unassigned`.
- **`assignTriageTicket()`** → `POST /api/tickets/{id}/assign` con spinner en botón.
- **`loadOperatorAssignments()`** → `/api/tickets/my-assignments`.
- **`startProcessingTicket()`** → `POST /api/tickets/{id}/start`.
- **`loadDispatchQueue()` / `renderDispatchQueue()`** → cola del tablero de tickets.
- **`loadTableroOperators()`** → KPIs de operadores + `loadCurrentWorkload`.
- **Gráficas:** `resolveChartCanvas()` usa `chartHourly` / `chartHourlyDemo`, `chartWeights` / `chartWeightsDemo`.
- **`fetch('/api/auth/me', { credentials: 'include' })`** para cookie de sesión.

---

## 3. Fase 2 — Flujo crítico validado (diseño lógico)

| Rol | Flujo | Comportamiento esperado |
|-----|--------|-------------------------|
| **Coordinador** | Ver `#coordinator-triage-panel` | `checkCoordinatorRoleAndInitTriage()` quita `hidden` si `role ∈ {COORDINADOR, ADMINISTRADOR}`. |
| **Coordinador** | Elegir operador + **Asignar** | `assignTriageTicket`: valida select; fila `#triage-row-{id}` se anima y elimina; refresco de operadores y cola. |
| **Coordinador** | Tablero **Asignar Ahora** | Modal + `confirmAssignment` con `credentials` y `coordinador_id`; refresco triage/cola. |
| **Operador** | **Mis Tareas Asignadas** | Tarjetas con **Poner en Proceso** → `EN PROGRESO` vía API. |
| **Operador** | **Resolver Tarea** | `complete` → estado FSM `POR_VERIFICAR` (backend existente). |

---

## 4. Fase 3 — Mejoras ITSM implementadas

| Mejora | Implementación |
|--------|----------------|
| **Spinners en acciones** | Botones `#btn-assign-{id}`, `#btn-process-{id}`, `#icon-refresh-triage`, `#icon-refresh-operator`, `#refresh-spin-icon`. |
| **Toasts éxito/error/warning** | `#toast-container` + `showToast()`; fallback a `#toast-notification` Stitch; `showStitchSuccessToast` delega a `showToast` si no hay modal Stitch. |
| **Empty states** | `#triage-empty-state`, `#operator-empty-assignments`, `#queue-empty-state` con copy amigable. |
| **Prevención de error asignación** | `wireTriageAssignButtons()`: `#btn-assign-{id}` **disabled** hasta elegir operador en `#select-operator-{id}`. |
| **Polling operador** | `startOperatorPolling()` cada 12s (existente, reconectado al panel). |

---

## 5. Archivos modificados

- `app/main.py` — SSR Jinja2 + helper de usuario
- `app/templates/dashboard.html` — Jinja2, paneles triage/operador, toast container, scripts, puente Stitch
- `app/static/js/dashboard.js` — Cola despacho, tabs, charts, toasts, triage wiring, auditoría, workload grids

---

## 6. Verificación local recomendada

```bat
cd C:\Users\josea\Desktop\PortalInterIp\app
pip install -r ..\infra\requirements.txt
py -3 -m uvicorn main:app --reload --port 8000
```

1. Abrir `http://127.0.0.1:8000/` — sidebar debe mostrar usuario Jinja + actualización vía `/api/auth/me`.
2. Con perfil **Coordinador**: Mesa de Triage con selects y Asignar; cola vacía muestra mensaje verde.
3. Conmutar a **Especialista** (dropdown header): panel **Mis Tareas**; **Poner en Proceso** / **Resolver**.
4. Pestaña **Tickets**: `#ticket-table-rows` poblado por API; empty state si no hay PENDIENTES.

---

## 7. Notas

- El diseño Tailwind/Stitch **no fue refactorizado**; solo se inyectaron bloques funcionales y se vaciaron filas demo de tablas sustituidas por render API.
- Si Python no está en PATH del entorno, usar el launcher `py -3` e instalar dependencias desde `infra/requirements.txt`.
