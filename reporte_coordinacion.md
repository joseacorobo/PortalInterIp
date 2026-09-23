# Reporte Técnico: Implementación de la Torre de Control y Panel de Coordinación (Triage y Validación DERS)

**Sistema:** Helpdesk de Operaciones IP - Inter  
**Fecha:** 22 de Septiembre de 2026  
**Rol:** Arquitecto de Software Full-Stack  
**Estado:** Implementado y Validado al 100%  

---

## 1. Resumen Ejecutivo

Se completó la implementación integral del sistema de **Torre de Control Sectorizada**, estableciendo una estricta separación de responsabilidades entre el rol de **Coordinador** y el rol de **Especialista**:
1. **Lógica de Triage Sectorizada (Backend):** Filtrado relacional estricto basado en claves foráneas (`departamento_id`), desestimando el uso del campo de texto plano `area`.
2. **Balanceo de Carga y Disponibilidad de Operadores:** Cálculo en vivo de la saturación de los especialistas en función de sus puntos activos actuales ('EN PROGRESO' y 'EN ESPERA').
3. **Máquina de Estados Finitos (FSM) de Aprobación en Dos Fases:**
   - **Fase 1 (Operador):** Al resolver la atención técnica, el ticket transiciona a `POR_VERIFICAR` (con duración neta calculada y puntos sugeridos).
   - **Fase 2 (Coordinador):** El Coordinador valida o ajusta la puntuación y cierra definitivamente a `COMPLETADO`, acreditando formalmente en la bitácora `task_logs`.
4. **Interfaz de Mesa de Asignación (Frontend):** Panel de Triage en `dashboard.html` con renderizado condicional para Coordinadores, Modo Claro corporativo y **purga total de terminología de correo electrónico** (reemplazada por "Solicitante", "Requerimiento Técnico", "Mesa de Asignación al Día").

---

## 2. Endpoints Implementados y Refinados (Backend FastAPI)

### 2.1. `GET /api/tickets/unassigned`
* **Ubicación:** `app/main.py`
* **Propósito:** Retorna exclusivamente los tickets de la tabla `email_tickets` pertenecientes al `departamento_id` del Coordinador autenticado cuyo estado sea `'PENDIENTE'`.
* **Reglas de Negocio:**
  - Obtiene el departamento del usuario autenticado vía Cookie de sesión `auth_user_id`, cabecera `X-User-Id` o token Bearer.
  - Filtro estricto relacional: `WHERE et.departamento_id = ? AND UPPER(et.status) = 'PENDIENTE'`.
  - Retorna metadatos de telecomunicaciones: Nodo OLT, Slot PON, Número de Serie ONT, Dirección MAC, Código de Abonado, Tarea sugerida y SLA.
  - Clasificación de prioridad automática P1 a P5 según los puntos estimados de la tarea.

### 2.2. `GET /api/operators/availability`
* **Ubicación:** `app/main.py`
* **Propósito:** Retorna la nómina de especialistas activos de la tabla `users` que pertenezcan al mismo `departamento_id` del Coordinador.
* **Cálculo Dinámico de Carga:**
  - Consulta en tiempo real los tickets activos (`status IN ('EN PROGRESO', 'EN ESPERA')`) asignados a cada operador.
  - Suma los puntos DERS de dichos casos activos, retornando:
    - `active_tickets_count` / `tickets_activos`: Número de casos concurrentes.
    - `active_points` / `puntos_activos`: Total de puntos de complejidad en curso.
    - `saturation_level`: Etiqueta contextual (`Disponible`, `Baja Carga`, `Carga Moderada`, `Sobrecarga`).
    - `saturation_color`: Código hexadecimal para los indicadores visuales.
  - Los resultados se ordenan de **menor a mayor carga** para favorecer el balanceo equitativo de trabajo.

### 2.3. `POST /api/tickets/{ticket_id}/assign`
* **Ubicación:** `app/main.py`
* **Payload:** `{ "operador_id": int, "coordinador_id": Optional[int], "notas": Optional[str] }`
* **Validaciones Estrictas:**
  1. Existencia del ticket y del operador.
  2. Validación de coherencia sectorial: El Coordinador, el ticket y el operador **deben pertenecer al mismo departamento**. Si se intenta asignar a un operador de otro departamento, el sistema deniega la operación con código HTTP 400.
  3. Transición de estado: Actualiza `operador_id`, `claimed_by_user_id`, y cambia el `status` a `'EN PROGRESO'`.
  4. Trazabilidad inmutable: Inserta un registro en `ticket_historial_estados` (`estado_anterior = 'PENDIENTE'`, `estado_nuevo = 'EN PROGRESO'`).
  5. Registro en bitácora forense de auditoría (`audit_logs`).

### 2.4. `POST /api/tickets/{ticket_id}/complete` (Ajuste FSM Fase 1)
* **Ubicación:** `app/main.py`
* **Comportamiento Ajustado:**
  - El especialista culmina su intervención técnica.
  - El estado resultante **NO es definitivo** (`COMPLETADO`); transiciona a **`POR_VERIFICAR`**.
  - Calcula la duración real de atención descontando pausas y registra la nota técnica en `ticket_historial_estados`.
  - Los puntos sugeridos quedan en espera de la validación del Coordinador.

### 2.5. `POST /api/tickets/{ticket_id}/verify` (Ajuste FSM Fase 2)
* **Ubicación:** `app/main.py`
* **Payload:** `{ "confirmed_points": Optional[int], "verification_notes": Optional[str], "coordinador_id": Optional[int] }`
* **Comportamiento:**
  - El Coordinador aprueba el cierre del ticket.
  - Permite confirmar los puntos sugeridos o ajustarlos según la complejidad técnica demostrada.
  - El ticket pasa a estado final `'COMPLETADO'`.
  - Se genera el registro oficial en `task_logs`, acreditando la puntuación para los reportes de rendimiento y productividad del turno.
  - Se registra el evento en `ticket_historial_estados` y `audit_logs`.

---

## 3. Cambios Visuales y Experiencia de Usuario (Frontend)

### 3.1. Mesa de Asignación (Triage) en `app/templates/dashboard.html`
* **Visibilidad Condicional:** El bloque `#coordinator-triage-panel` y la pestaña `#tab-coordinacion` se visualizan únicamente cuando el usuario activo posee rol `COORDINADOR` o `ADMINISTRADOR`. Al conmutar de usuario, el panel se activa o desactiva de inmediato.
* **Componentes del Panel:**
  1. **Encabezado Informativo:** Badge con el área operativa del coordinador y contador dinámico de casos pendientes.
  2. **Tabla de Triage:**
     - Identificador del ticket y badge de prioridad P1-P5.
     - Asunto y Solicitante debidamente identificados con icono `user`.
     - Parámetros técnicos de fibra: Nodo OLT, Abonado, PON Slot, Serial ONT y MAC.
     - Tarea sugerida con puntos estimados y SLA en minutos.
     - Tiempo de espera transcurrido.
     - Selector desplegable `<select>` alimentado con los operadores disponibles del área, detallando su nombre, avatar, casos activos y nivel de saturación.
     - Botón `Asignar` que ejecuta la asignación vía `fetch()` con animación fluida de retiro de fila y actualización de contadores.
  3. **Pestaña Completa de Coordinación (`#tab-coordinacion`):**
     - Layout de dos columnas: Cola de casos sin asignar a la izquierda y tarjetas de disponibilidad de especialistas a la derecha.
     - Sección de **Cola de Verificación de Puntos (`POR_VERIFICAR`)**: Tabla donde el coordinador revisa los casos concluidos por los especialistas, con opción de validación rápida en un clic o ajuste numérico de puntos antes del cierre.

### 3.2. Directrices de Estética Corporativa y Erradicación de Términos de Correo
* **Paleta Modo Claro:** Fondos blancos y slate pulido (`#F8FAFC`, `#FFFFFF`), bordes sutiles (`#E4E9F3`), acentos azules corporativos (`#0057cd`, `#1C58A8`) y estados de saturación normalizados (verde esmeralda, azul, ámbar y rojo).
* **Purga de Terminología:**
  - Se eliminaron vocablos como "Bandeja" o "Correo" en todos los módulos de triage y coordinación.
  - Se renombraron a:
    - `"Mesa de Asignación (Triage)"`
    - `"Mesa de Asignación al Día"`
    - `"Solicitante: [nombre/identificador]"` (en lugar de remitente o correo).
  - Los iconos de sobres/correo (`mail`, `inbox`) fueron sustituidos por iconos semánticos de sistemas Helpdesk (`user`, `layers`, `clipboard-check`).

---

## 4. Matriz de Pruebas y Validación de la Solución

| Prueba | Acción | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|:---:|
| **Filtro FK Tickets** | `GET /api/tickets/unassigned` (Coord. Carlos Méndez, Dept 1) | Solo tickets con `departamento_id = 1` y status `PENDIENTE` | 35 tickets devueltos, 100% depto 1 | **PASÓ** |
| **Disponibilidad Operadores** | `GET /api/operators/availability` (Dept 1) | Operadores del Dept 1 con puntos activos en vivo | 4 operadores retornados, puntos dinámicos calculados (2 a 6 pts) | **PASÓ** |
| **Rechazo Cruzado** | `POST /assign` ticket Dept 1 a Operador Dept 2 | Error HTTP 400 por discrepancia departamental | HTTP 400: Error de departamento | **PASÓ** |
| **Asignación Exitosa** | `POST /assign` ticket Dept 1 a Operador Dept 1 | Status `EN PROGRESO`, operador asignado, historial registrado | Status actualizado y fila en `ticket_historial_estados` | **PASÓ** |
| **FSM Fase 1** | `POST /complete` por Especialista | Status pasa a `POR_VERIFICAR` (no definitivo) | Status en DB = `POR_VERIFICAR`, duración calculada | **PASÓ** |
| **FSM Fase 2** | `POST /verify` por Coordinador | Status pasa a `COMPLETADO` y acredita en `task_logs` | Status = `COMPLETADO`, puntos acreditados en `task_logs` | **PASÓ** |
| **Perfil y Autenticación** | `GET /api/auth/me` con `X-User-Id` / Token | Reconoce rol y departamento activo | Retorna perfil de coordinador con `departamento_id: 1` | **PASÓ** |

---

## 5. Conclusión

El sistema Helpdesk cuenta con una **Torre de Control sectorizada** funcional y robusta. Los coordinadores de las 5 áreas operativas (Redes de Acceso, Tráfico Inalámbrico, Seguridad, Telefonía y Redes WAN) disponen de visibilidad exclusiva sobre sus tickets pendientes, capacidad de balancear la carga de sus operadores en tiempo real y gobernanza sobre la acreditación de puntos antes del cierre definitivo de las incidencias.
