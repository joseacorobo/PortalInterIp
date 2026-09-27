---
name: Telecom Precision Analytics
colors:
  surface: '#F3F6FC'
  surface-dim: '#CBD5E1'
  surface-bright: '#FFFFFF'
  surface-container-lowest: '#FFFFFF'
  surface-container-low: '#F8FAFC'
  surface-container: '#EFF4FB'
  surface-container-high: '#E4E9F3'
  surface-container-highest: '#DCE4F0'
  on-surface: '#101828'
  on-surface-variant: '#5B6B89'
  inverse-surface: '#0B1322'
  inverse-on-surface: '#EEF2FA'
  outline: '#E4E9F3'
  outline-variant: '#EEF2F8'
  surface-tint: '#1C58A8'
  primary: '#1C58A8'
  on-primary: '#FFFFFF'
  primary-container: '#2E74C9'
  on-primary-container: '#FFFFFF'
  inverse-primary: '#5B9BE0'
  secondary: '#0B3B78'
  on-secondary: '#FFFFFF'
  secondary-container: '#071F3F'
  on-secondary-container: '#FFFFFF'
  tertiary: '#F4B400'
  on-tertiary: '#1A1200'
  tertiary-container: '#FEF6E0'
  on-tertiary-container: '#B45309'
  error: '#EF4444'
  on-error: '#FFFFFF'
  error-container: '#FEF2F2'
  on-error-container: '#991B1B'
  primary-fixed: '#EAF2FC'
  primary-fixed-dim: '#B8DAF7'
  on-primary-fixed: '#071F3F'
  on-primary-fixed-variant: '#154687'
  secondary-fixed: '#E2E8F0'
  secondary-fixed-dim: '#98A3B8'
  on-secondary-fixed: '#0B1326'
  on-secondary-fixed-variant: '#334155'
  tertiary-fixed: '#FEF6E0'
  tertiary-fixed-dim: '#FDE68A'
  on-tertiary-fixed: '#451A03'
  on-tertiary-fixed-variant: '#D97706'
  background: '#F3F6FC'
  on-background: '#101828'
  surface-variant: '#EAF2FC'
typography:
  display:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: '700'
    lineHeight: 2.5rem
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  metric-xl:
    fontFamily: JetBrains Mono
    fontSize: 1.875rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.03em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.125rem
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: 0.875rem
  code-telemetry:
    fontFamily: JetBrains Mono
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.625rem
  lg: 0.75rem
  xl: 1rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.875rem
  space-lg: 1.25rem
  space-xl: 2rem
---

# Telecom Precision Analytics (Inter NOC — Portal Operaciones IP)

Este sistema de diseño está concebido para operaciones de telecomunicaciones de misión crítica (NOC y cuadrillas FTTH de Inter Telecomunicaciones C.A.), gestión de incidencias bajo Máquina de Estados Finitos (FSM) y balance dinámico de saturación técnica (Catálogo DERS).

---

## 1. Identidad de Marca y Principios Operacionales

- **Alineación Visual Corporativa:** Estilo **Corporate Modern con Tactile Glassmorphism inspirado en macOS / Web Telecom Precision**.
- **Cero Fricción para el Ingeniero:** Interfaces limpias, de alta densidad visual pero descansadas al ojo, con métricas legibles al primer golpe de vista (*glanceable telemetry*).
- **Semántica Estricta:** Separación cromática absoluta entre navegación estructural, contenedores de datos y severidad de incidentes.
- **Doble Modo Nativo:** Soporte integral de Modo Claro (`data-theme="light"`, nativo por defecto) y Modo Oscuro (`data-theme="dark"`).

---

## 2. Paleta de Colores y Tokens Semánticos

### 2.1 Tokens CSS en `:root` (Modo Claro)
```css
:root {
  /* Superficies */
  --bg:                       #F3F6FC;  /* Canvas base */
  --panel:                    #FFFFFF;  /* Tarjetas y módulos */
  --sidebar-bg:               #FFFFFF;  /* Fondo de barra lateral */

  /* Bordes */
  --border:                   #E4E9F3;  /* Borde primario sutil */
  --border-2:                 #EEF2F8;  /* Borde secundario */

  /* Textos */
  --text:                     #101828;  /* Títulos y texto principal */
  --muted:                    #5B6B89;  /* Texto secundario y metadatos */
  --muted-2:                  #98A3B8;  /* Placeholders y detalles sutiles */

  /* Azul Corporativo Inter */
  --brand:                    #1C58A8;  /* Azul oficial Inter */
  --brand-2:                  #2E74C9;  /* Azul de interacción / hover */
  --brand-tint:               #EAF2FC;  /* Tint de fondo de selección / foco */

  /* Navy NOC (Severidad Alta / Crítica) */
  --navy:                     #0B3B78;  /* Navy P4 */
  --navy-ink:                 #071F3F;  /* Navy Ink P5 y avatares */

  /* Amarillo / Ámbar (Severidad Media / Advertencia) */
  --yellow:                   #F4B400;  /* Amarillo alerta P3 */
  --yellow-tint:              #FEF6E0;  /* Fondo tenue P3 */

  /* Verde Esmeralda (Éxito / En vivo / Resuelto) */
  --emerald:                  #059669;
  --emerald-tint:             #ECFDF5;

  /* Rojo Carmesí (P1 Outage / Alerta Seguridad / Crítico) */
  --crimson:                  #EF4444;
  --crimson-tint:             #FEF2F2;
}
```

### 2.2 Tokens CSS en `html[data-theme="dark"]` (Modo Oscuro)
```css
html[data-theme="dark"] {
  --bg:                       #0B1322;
  --panel:                    #111B2E;
  --sidebar-bg:               #090F1C;
  --border:                   #233052;
  --border-2:                 #1B2740;
  --text:                     #EEF2FA;
  --muted:                    #93A1C0;
  --muted-2:                  #5E6C8C;
  --brand:                    #5B9BE0;
  --brand-2:                  #7CB2EA;
  --brand-tint:               rgba(91, 155, 224, 0.14);
  --navy:                     #8FB7E8;
  --navy-ink:                 #DCE9FA;
  --yellow:                   #F5C24D;
  --yellow-tint:              rgba(245, 194, 77, 0.12);
}
```

---

## 3. Escala y Regla Estricta de Severidad DERS (P1 a P5)

Las etiquetas y contadores de tickets deben respetar **rigurosamente** la escala de colores para evitar disonancia cognitiva:

| Prioridad | Complejidad | Puntos | Background | Color Texto | Casos Típicos |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **P1** | Muy Baja | **1 pt** | `#EAF2FC` (Brand Tint) | `#2E74C9` (Brand 2) | Consulta ONT en OLT, estado de link |
| **P2** | Baja | **2 pts** | `#E2E8F0` (Slate Soft) | `#1C58A8` (Brand) | Discrepancia MAC, prueba de velocidad |
| **P3** | Media | **3 pts** | `#FEF6E0` (Yellow Tint)| `#B45309` (Amber) | Desatasco demonio OLT, cambio SFP |
| **P4** | Alta | **5 pts** | `#0B3B78` (Navy) | `#FFFFFF` (Blanco) | Modo Bridge + IP Certificada, VoIP MOS |
| **P5** | Crítica | **8 pts** | `#071F3F` (Navy Ink) | `#FFFFFF` (Blanco) | PortChannel 10G/20G, contingencia Core |

> *Nota de Excepción en Outages Mayores:* En caídas de servicio masivas o indisponibilidad de OLT completa, los badges de incidente usan contenedor oscuro `#0F172A` o rojo `#EF4444`.

### Barras de Saturación de Cuadrilla DERS:
- **Equilibrada ($\le 25$ pts):** Barra en `--brand-2` (`#2E74C9`). Carga saludable.
- **Moderada ($26 - 45$ pts):** Barra en `--yellow` (`#F4B400`). Alerta de turno.
- **Alta / Crítica ($> 45$ pts):** Barra en `--navy` (`#0B3B78`) o `--crimson` (`#EF4444`). Cuello de botella.

---

## 4. Tipografía y Reglas Numéricas

- **Fuente Primaria (UI & Textos):** `Inter`, system-ui, -apple-system, sans-serif.
- **Fuente Monospace (Números, Seriales y Telemetría):** `JetBrains Mono`, monospace.
- **Tabular Lining:** Obligatorio en todo valor numérico, temporizador, serial y código de OLT:
  ```css
  font-feature-settings: "tnum" 1, "zero" 1;
  ```
- **Tracking:** Títulos con tracking negativo (`-0.015em` a `-0.025em`) para consistencia visual densa y limpia.

---

## 5. Layout, Grilla y Dimensiones Estructurales

- **Grilla Principal:**
  - **Desktop ($\ge 1440$px):** 12 columnas, `gap: 1rem` (16px), `margin: 1.5rem`.
  - **Tablet ($768$px – $1439$px):** 8 columnas, `gap: 1rem`.
  - **Mobile ($< 768$px):** 4 columnas, `gap: 0.75rem`.
- **Barra Lateral (Sidebar):**
  - **Expandida:** `width: 16rem` (256px).
  - **Colapsada (Mini-Sidebar):** `width: 4.5rem` (72px).
  - **Transición:** `240ms cubic-bezier(0.4, 0, 0.2, 1)`.
- **Encabezado Superior (Header):** `height: 3.5rem` (56px), fijo (`sticky top-0 z-30`), borde inferior `1px solid var(--border)`.

---

## 6. Elevaciones y Sombras

- **Nivel 0 (Canvas):** Fondo plano en `var(--bg)` (`#F3F6FC`).
- **Nivel 1 (Tarjetas Operacionales):** `var(--panel)` con borde `1px solid var(--border)` y sombra `box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04)`.
- **Nivel 2 (Hover Activo):** `transform: translateY(-1px)`, borde `#93C5FD` o `#1C58A8` al 30%, sombra `0 4px 12px rgba(28, 88, 168, 0.06)`.
- **Nivel 3 (Modales & Popovers):** Fondo `var(--panel)`, sombra `0 12px 28px -4px rgba(15, 23, 42, 0.12)`.
- **Nivel 4 (Toasts Flotantes):** Notificaciones en esquina superior derecha con borde sutil, acento vertical lateral de 6px y sombra `0 10px 25px -5px rgba(0, 0, 0, 0.08)`.

---

## 7. Catálogo de Componentes Específicos de Operaciones IP

### 7.1 Tarjetas KPI (Normal y Hero)
- **Normal:** Fondo blanco, radio `0.625rem` (10px), padding `1.25rem 1.375rem`, etiqueta superior en `0.75rem` (`var(--muted)`), número central destacado en JetBrains Mono (`1.875rem` / bold), píldora de tendencia inferior.
- **Hero KPI (Meta de Producción Ponderada):** Gradiente diagonal `linear-gradient(135deg, rgba(28, 88, 168, 0.15) 0%, rgba(7, 31, 63, 0.95) 100%)`, backdrop blur 24px, borde `1px solid rgba(46, 116, 201, 0.3)`.

### 7.2 Entidades Técnicas Telco en Fichas de Ticket
En cada tarjeta de ticket de soporte o requerimiento deben visualizarse:
- **Abonado:** 10 dígitos (ej. `1029384756`, donde `10` = Permisor P-10).
- **Serial PON:** 12 caracteres (ej. `FHTT1234ABCD` para FiberHome, `HWTC9876ZYXW` para Huawei).
- **OLT:** Formato canónico `OLT-[Acrónimo Ciudad]-[Número]` (ej. `OLT-CCS-01`, `OLT-VAL-02`).
- **Ubicación Slot/PON:** *Consultar en OLT vía Serial PON* o `Slot 0/1/3`.
- **Alerta de Modo Bridge / IP Certificada:** Banner rojo mandatorio de advertencia que prohíbe reaprovisionamiento destructivo.

### 7.3 Máquina de Estados Finitos (FSM) y Controles del Cronómetro
- **Pendiente:** Botón de acción `Atender` (marca `claimed_at`).
- **En Progreso:** Cronómetro en vivo en formato `HH:MM:SS` (fuente JetBrains Mono, color Brand). Botones `Pausar` y `Resolver`.
- **En Espera (Pausa de Cuadrilla de Terreno):** Cronómetro congelado, indicador ámbar. Botón `Reanudar`. El tiempo acumulado en pausa **no penaliza** el MTTR del especialista.
- **Resuelto:** Marca `closed_at`, cálculo de MTTR neto y acreditación de puntos DERS.

### 7.4 Form Controls y Botones
- **Inputs & Selects:** Fondo `#FFFFFF`, radio `0.5rem`, borde `1px solid var(--border)`, padding `0.6rem 0.85rem`. Foco con `border-color: var(--brand)` y halo `box-shadow: 0 0 0 3px rgba(28, 88, 168, 0.12)`.
- **Botón Primario (`.btn-primary`):** Fondo `var(--brand)` (`#1C58A8`), texto blanco, radio `0.5rem`, hover en `var(--brand-2)` con elevación `translateY(-1px)`.
- **Botón Secundario (`.btn-secondary`):** Fondo blanco, borde `1px solid var(--border)`, texto `var(--text)`, hover en `var(--border-2)`.

### 7.5 Toasts en Vivo
- Contenedor fijo en `#toast-container` (`fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full`).
- Animación `slideInRight` de entrada con barra lateral de acento (`bg-[#1C58A8]` para asignaciones, `bg-emerald-600` para cierres exitosos).
