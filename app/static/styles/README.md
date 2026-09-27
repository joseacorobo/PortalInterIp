# Arquitectura de Estilos CSS — Portal Inter Operaciones IP
**Sistema de Diseño:** Telecom Precision Analytics (Stitch NOC)  
**Ubicación:** `app/static/styles/`

Esta carpeta centraliza y modulariza todas las hojas de estilo del portal. Cada archivo cumple un rol específico y se encuentra documentado internamente con su alcance y referencias.

---

## 1. Catálogo de Archivos y Responsabilidades

| Archivo | A qué hace referencia | Qué se encuentra ahí |
|---|---|---|
| **[`theme_tokens.css`](file:///c:/Users/josea/Desktop/PortalInterIp-main/app/static/styles/theme_tokens.css)** | Tokens globales y variables cromáticas corporativas | Variables `:root` y `html[data-theme="dark"]`, paleta Inter Blue (`#1C58A8`), Navy (`#0B3B78`), Amarillo (`#F4B400`), superficies, bordes, tipografía Inter y scrollbar corporativo. |
| **[`snow_ui.css`](file:///c:/Users/josea/Desktop/PortalInterIp-main/app/static/styles/snow_ui.css)** | Primitivas y componentes visuales base (SnowUI) | Badges de severidad/estado, elevaciones de tarjetas, barras de progreso de SLA, tooltips contextuales y botones estándar. |
| **[`sidebar_navigation.css`](file:///c:/Users/josea/Desktop/PortalInterIp-main/app/static/styles/sidebar_navigation.css)** | Barra lateral de navegación interactiva | Dimensionamiento expandido (17.5rem) vs colapsado (4.75rem), botón de rotación chevron, acordeón de tickets, píldoras activas y tarjeta de usuario. |
| **[`dashboard_layout.css`](file:///c:/Users/josea/Desktop/PortalInterIp-main/app/static/styles/dashboard_layout.css)** | Disposición del dashboard y componentes de datos | Cuadrícula de 12 columnas, scorecards ejecutivas (`.dashboard-kpi-card`), contenedores de gráficos, tablas técnicas (`.table-corporate-metrics`), animaciones `fadeInUp`/`pulseGlow`, botones píldora y modales. |
| **[`login_auth.css`](file:///c:/Users/josea/Desktop/PortalInterIp-main/app/static/styles/login_auth.css)** | Pantalla de acceso y autenticación (`login.html`) | Escenario 3D interactivo de malla de nodos (`#networkCanvas`), gradientes atmosféricos perimetrales y campos con anillo de foco dinámico. |
| **[`main.css`](file:///c:/Users/josea/Desktop/PortalInterIp-main/app/static/styles/main.css)** | Entrada maestra / Bundle | Agrupa e importa de forma ordenada los 4 módulos principales del dashboard mediante directivas `@import`. |

---

## 2. Inclusión en Plantillas

- **[`dashboard.html`](file:///c:/Users/josea/Desktop/PortalInterIp-main/app/templates/dashboard.html):**  
  Carga los módulos independientes o `main.css`:
  ```html
  <link rel="stylesheet" href="/static/styles/theme_tokens.css">
  <link rel="stylesheet" href="/static/styles/snow_ui.css">
  <link rel="stylesheet" href="/static/styles/sidebar_navigation.css">
  <link rel="stylesheet" href="/static/styles/dashboard_layout.css">
  ```
- **[`login.html`](file:///c:/Users/josea/Desktop/PortalInterIp-main/app/templates/login.html):**  
  ```html
  <link rel="stylesheet" href="/static/styles/login_auth.css">
  ```
