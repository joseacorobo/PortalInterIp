# Especificación de implementación — Panel Operaciones IP
Para pegar directo en Antigravity (Manager view) como brief del agente.

## 0. Modelo de lenguaje recomendado

**Usa Claude Sonnet 4.6 como modelo del agente principal**, no el Gemini nativo de Antigravity, por esto específicamente:

- Este no es un proyecto desde cero: es **fusionar dos repos existentes** (`PrototipoWeb_OperacionesIP` + el módulo de comandos de `PHS.OperacionesIP`) y aplicar un rediseño **sobre un diseño ya cerrado con tokens exactos**. Eso exige seguir una spec al pie de la letra y mantener consistencia en cientos de líneas de CSS/HTML — es el punto fuerte de Sonnet frente a modelos más "creativos" que tienden a reinterpretar el diseño.
- Vas a tocar backend real (FastAPI, SQLite, IMAP) donde un error silencioso rompe datos de producción — priorizar precisión sobre velocidad.
- Antigravity soporta Sonnet 4.6 como modelo de terceros desde el selector de modelo del agente; no necesitas quedarte con el Gemini por defecto.

**Cuándo sí usar el Gemini nativo:** si en el Manager view quieres lanzar un agente en paralelo solo para tareas mecánicas y descartables (por ejemplo, generar datos de prueba/seed, o un scaffold inicial de carpetas) — ahí la velocidad importa más que la fidelidad. Pero el agente que toca UI y lógica de negocio, en Sonnet.

## 1. Base de código

Fusiona sobre `PrototipoWeb_OperacionesIP` (es el más completo: auth/RBAC, motor DERS, FSM, worker IMAP). Del segundo repo, rescata solo el módulo de Asistente de Comandos (Módulo 5, hoy "PAUSADO" en tu ROADMAP).

```
app/
├── main.py                  # ya tiene todas las rutas — ver mapeo abajo
├── static/css/snow_ui.css   # AQUÍ van los tokens nuevos (sección 2)
├── static/js/dashboard.js   # lógica de vistas/acordeón/tema
└── templates/dashboard.html # estructura — reemplazar por el HTML del artifact
```

## 2. Design tokens (pegar en `snow_ui.css`, reemplazando el bloque `:root`/`.dark` actual)

```css
:root{
  --bg:#F3F6FC; --panel:#FFFFFF; --sidebar-bg:#FFFFFF;
  --border:#E4E9F3; --border-2:#EEF2F8;
  --text:#101828; --muted:#5B6B89; --muted-2:#98A3B8;
  --brand:#1C58A8;      /* azul extraído del logo oficial */
  --brand-2:#2E74C9;
  --brand-tint:#EAF2FC;
  --navy:#0B3B78; --navy-ink:#071F3F;
  --yellow:#F4B400; --yellow-tint:#FEF6E0;
}
html[data-theme="dark"]{
  --bg:#0B1322; --panel:#111B2E; --sidebar-bg:#0E1728;
  --border:#233052; --border-2:#1B2740;
  --text:#EEF2FA; --muted:#93A1C0; --muted-2:#5E6C8C;
  --brand:#5B9BE0; --brand-2:#7CB2EA; --brand-tint:rgba(91,155,224,.14);
  --navy:#8FB7E8; --navy-ink:#DCE9FA;
  --yellow:#F5C24D; --yellow-tint:rgba(245,194,77,.12);
}
```

**Tipografía:** `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Helvetica, Arial, sans-serif` — sistema nativo, sin `@font-face` (SF Pro no tiene licencia web).

**Regla de color no negociable:** azul = normal, amarillo = atención/moderado, azul marino oscuro = alto/crítico. Nunca rojo ni verde. La severidad se distingue por intensidad, no por matiz distinto.

## 3. Inventario de componentes → dónde vive cada uno

| Componente del diseño | Archivo/función a crear o adaptar | Endpoint que lo alimenta (ya existe) |
|---|---|---|
| Sidebar (logo, perfil, nav, acordeón de áreas) | `templates/partials/sidebar.html` | `GET /api/auth/me` (perfil), `GET /api/auth/users` |
| Toggle claro/oscuro | `static/js/theme.js` (nuevo, ~15 líneas) | — (solo `localStorage`, no toca backend) |
| 4 stat cards (carga, esperando, MTTR, balance) | `dashboard.js → renderAnswerRow()` | `GET /api/kpis` |
| Cola en 3 columnas (Pendiente/Progreso/Espera) | `dashboard.js → renderQueue()` | `GET /api/tickets/inbox` + `POST /api/tickets/{id}/claim` / `/pause` / `/resume` / `/complete` |
| Lista de saturación por especialista | `dashboard.js → renderSaturation()` | `GET /api/charts/technicians` |
| Filtros de período (Hoy/7d/Mes) | `dashboard.js → applyDateFilter()` | `GET /api/reports/summary?range=` |
| Barras DERS por célula + MTTR por célula | `dashboard.js → renderCellBars()` | `GET /api/charts/technicians`, `GET /api/reports/summary` |
| Donut P1–P5 | `dashboard.js → renderComplexityDonut()` | `GET /api/charts/task-weights` |
| Curva de incidencias por hora | `dashboard.js → renderHourlyChart()` | `GET /api/charts/hourly` |
| Botón exportar Excel | — (ya funciona) | `GET /api/reports/export/excel` |

**No hay endpoints nuevos que crear** — el backend ya cubre el 100% de lo que el diseño necesita. El trabajo real es de frontend: reemplazar el HTML/CSS actual y conectar cada componente a su endpoint ya existente.

## 4. Plan de tareas para el Manager view de Antigravity

Divide en agentes/tareas así (uno puede depender del anterior):

1. **Tokens y tema** — reemplazar `snow_ui.css` con la sección 2, implementar el toggle claro/oscuro con persistencia en `localStorage`.
2. **Sidebar** — construir el sidebar con logo real (`static/img/inter_logo.png`), acordeón de áreas, colapso a 76px, y modo off-canvas responsivo (<900px).
3. **Vista operativa** — stat cards + cola de 3 columnas + saturación, conectados a los endpoints de la tabla anterior. *(Depende de 1 y 2)*
4. **Vista de métricas** — filtros, barras por célula, donut P1–P5, curva de incidencias. *(Depende de 1 y 2)*
5. **QA visual** — captura de pantalla en claro y oscuro, revisar contraste y que el sidebar colapse/expanda sin saltos.

Dale este documento completo al agente como contexto inicial antes de la tarea 1 — así no tiene que inferir los tokens ni el mapeo de endpoints, que es justamente donde un modelo menos preciso empieza a improvisar.
