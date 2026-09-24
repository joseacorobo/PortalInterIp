---
name: agentes personalizados
description: >-
  Guía completa y referencia para diseñar, configurar, estructurar e invocar
  Agentes Personalizados (Custom Agents) en Google Antigravity (Antigravity 2.0, CLI e IDE).
  Activa esta habilidad cuando el usuario pregunte sobre cómo crear agentes personalizados,
  dónde se guardan sus archivos (.agents/agents/), qué campos YAML llevan en su frontmatter,
  cómo funcionan la simetría de ejecución (mainAgent vs subagent), las políticas de seguridad
  (commandExecutionPolicy), la delimitación de herramientas (tools) y habilidades (skills), o
  cuando se requiera implementar un nuevo agente especializado para el proyecto.
---

# Guía de Agentes Personalizados (Custom Agents) en Google Antigravity

Los **Agentes Personalizados (Custom Agents)** son configuraciones especializadas basadas en archivos que definen un rol particular con sus propias instrucciones acotadas, herramientas delimitadas, modelo y restricciones de seguridad.

A diferencia de un asistente generalista cargado con decenas de herramientas e instrucciones globales, los agentes personalizados permiten la **división del trabajo** en ingeniería de software: dividen proyectos complejos en especialistas que actúan, verifican y ejecutan tareas de forma predecible, con menor consumo de tokens y sin sobrecargar el contexto activo.

---

## 1. Diferencia entre Custom Agents, Skills y Subagentes Dinámicos

Concepto | ¿Qué es? | Propósito Principal | Dónde se define
:--- | :--- | :--- | :---
**Custom Agent** | Agente especializado con prompt de sistema, modelo, herramientas y permisos propios. | Asistente de rol completo (ej. auditor, modernizador de dependencias, revisor de código). | `.agents/agents/<nombre>.md` o `~/.gemini/config/agents/<nombre>.md`
**Skill (Habilidad)** | Carpeta de instrucciones, scripts y referencias bajo demanda (*progressive disclosure*). | Enseñar procedimientos paso a paso, manuales de uso o runbooks. | `.agents/skills/<nombre>/SKILL.md`
**Dynamic Subagent** | Subagente creado sobre la marcha por el agente principal con un prompt ad-hoc. | Delegar subtareas temporales aisladas para no ensuciar el contexto principal. | En tiempo de ejecución (memoria)

> [!NOTE]
> Los Custom Agents no reemplazan a las habilidades ni a los subagentes dinámicos; se complementan. Un Custom Agent puede declarar en su frontmatter una lista restringida de `skills` y `tools` exclusivas para su función.

---

## 2. Ubicación y Ámbitos de Almacenamiento

Los agentes personalizados se definen en un único archivo Markdown (`.md`):

1. **Nivel Proyecto / Espacio de Trabajo (Recomendado para equipos)**:
   - **Ruta**: `.agents/agents/<nombre-agente>.md` (relativo a la raíz del repositorio).
   - **Alcance**: Específico del proyecto actual. Al agregarlo a control de versiones (Git), cualquier desarrollador que clone el repositorio tiene acceso inmediato y estandarizado al agente sin configuración manual.
2. **Nivel Global / Usuario**:
   - **Ruta**: `~/.gemini/config/agents/<nombre-agente>.md` (en Windows: `C:\Users\<usuario>\.gemini\config\agents\<nombre-agente>.md`).
   - **Alcance**: Disponible en cualquier proyecto abierto en la máquina local.
3. **Nivel Plugin**:
   - **Ruta**: `plugins/<plugin-name>/agents/<nombre-agente>.md`.

---

## 3. Estructura y Formato del Archivo (`.md`)

Cada agente personalizado consta de dos partes:
1. **Encabezado YAML Frontmatter** (entre delimitadores `---`): Configuración técnica y metadatos de ejecución.
2. **Cuerpo en Markdown**: Se compila directamente como las **Instrucciones Centrales (System Prompt)** del agente.

### Esquema Completo de Campos YAML

Campo | Tipo | Requerido | Descripción | Ejemplo
:--- | :---: | :---: | :--- | :---
`name` | `string` | **Sí** | Identificador único del agente (kebab-case recomendado). | `dependency-modernizer`
`description` | `string` | **Sí** | Explicación en texto claro de qué hace el agente y cuándo debe usarse. El agente coordinador la usa para saber cuándo invocarlo. | `Audita y actualiza dependencias del proyecto.`
`model` | `string` | No | Modelo de lenguaje asignado (ej. `flash`, `pro`, `sonnet`). | `flash`
`mainAgent` | `boolean` | No | Si es `true`, permite iniciar sesiones primarias directamente como este agente (GUI o CLI). Por defecto `false`. | `true`
`subagent` | `boolean` | No | Si es `true`, permite que otros agentes lo invoquen como herramienta de trabajo subordinada. Por defecto `true`. | `true`
`permissionMode` | `string` | No | Nivel de permisos de edición (ej. `acceptEdits`, `bypassPermissions`). | `acceptEdits`
`commandExecutionPolicy` | `string` | No | Política de ejecución de comandos terminal: `auto` permite ejecutar pruebas y compilación en segundo plano sin pedir confirmaciones constantes. | `auto`
`tools` | `list[str]` | No | Lista blanca explícita de herramientas que el agente puede usar. Omite herramientas innecesarias para evitar alucinaciones. | `[view_file, replace_file_content, run_command]`
`skills` | `list[str]` | No | Lista de habilidades asociadas que se inyectan en el contexto del agente. | `[skills/package-upgrade-rules]`

---

## 4. Características Únicas en Antigravity

### A. Simetría de Ejecución (`mainAgent` vs `subagent`)
En la mayoría de herramientas, los agentes personalizados solo pueden ser subagentes subordinados. Antigravity permite **simetría total**:
- **Como Agente Principal (`mainAgent: true`)**:
  - En la aplicación de escritorio **Antigravity 2.0**: Se selecciona directamente en el menú desplegable de agentes.
  - En la consola **Antigravity CLI**: Se ejecuta directamente con:
    ```bash
    agy --agent dependency-modernizer
    ```
  - La conversación interactúa directamente con el agente y sus instrucciones centrales son el prompt de sistema.
- **Como Subagente (`subagent: true`)**:
  - El agente coordinador principal evalúa las descripciones y delega subtareas complejas al agente en segundo plano.

### B. Políticas de Seguridad Acotadas (`commandExecutionPolicy: auto`)
Evita la frustración de aprobar comandos rutinarios (como `npm test`, `pytest`, `cargo check`) sin comprometer la seguridad:
```yaml
permissionMode: acceptEdits
commandExecutionPolicy: auto
```
Con `commandExecutionPolicy: auto`, el agente ejecuta ciclos rápidos de prueba y error en segundo plano, mientras que operaciones críticas (como eliminación de archivos o cambios de infraestructura) se mantienen protegidas.

### C. Herramientas y Habilidades Acotadas (`tools` y `skills`)
Previene el "context bloat" y la confusión de herramientas limitando el entorno:
```yaml
tools:
  - view_file
  - replace_file_content
  - run_command
skills:
  - skills/security-best-practices
```
El agente no tendrá acceso a herramientas irrelevantes (como automatización de navegadores o consultas a bases de datos), manteniéndose 100% enfocado en su tarea.

---

## 5. Plantilla Base (101 Blueprint)

Para crear un nuevo agente en este repositorio, crea el archivo:
`.agents/agents/mi-nuevo-agente.md`

```markdown
---
name: mi-nuevo-agente
description: Resumen claro y conciso de cuándo y para qué debe utilizarse este agente.
model: flash
mainAgent: true
subagent: true
permissionMode: acceptEdits
commandExecutionPolicy: auto
tools:
  - view_file
  - replace_file_content
  - run_command
  - manage_task
skills:
  - skills/mi-habilidad-relevante
---

# Instrucciones Centrales

Eres un especialista enfocado en [definir rol]. Tu objetivo principal es [describir misión].

## Flujo de Trabajo
1. Analiza el problema utilizando `view_file`.
2. Realiza cambios precisos con `replace_file_content`.
3. Ejecuta las pruebas automatizadas con `run_command` para validar que no haya regresiones.
4. Reporta el resultado de manera concisa.

## Reglas y Restricciones
- Nunca modifiques archivos fuera del alcance asignado.
- Mantén la consistencia de estilos y convenciones del proyecto.
```

---

## 6. Ejemplo Práctico: Agente de Calidad y Pruebas para este Proyecto

Archivo: `.agents/agents/noc-ticket-auditor.md`

```markdown
---
name: noc-ticket-auditor
description: Especialista en auditar la lógica de asignación, cálculo DERS y reglas de no-SLA/MTTR del Portal Operaciones IP.
model: flash
mainAgent: true
subagent: true
permissionMode: acceptEdits
commandExecutionPolicy: auto
tools:
  - view_file
  - grep_search
  - run_command
---

# Auditor de Operaciones IP - Inter NOC

Eres el auditor técnico del sistema de despacho y tickets de Operaciones IP.

## Responsabilidades
1. **Regla de Cero Acrónimos Técnicos**: Asegura que en ningún template o interfaz aparezcan las siglas "SLA" ni "MTTR"; deben figurar como "Tiempo Objetivo" y "Tiempo Promedio de Solución".
2. **Equidad DERS**: Verifica que los cálculos de carga de operadores respeten los 6 departamentos oficiales (`ACCESO_APROV`, `TRAFICO_INALAMBRICO`, `REDES_WAN`, `SEGURIDAD`, `TELEFONIA`, `GRANDES_CLIENTES`).
3. **Verificación Automatizada**: Ejecuta las suites `test_sec*.py` y `test_roles_eval.py` con `uv.exe` para asegurar cero regresiones.
```

---

## 7. Verificación y Checklist de Creación

Al crear o auditar un Custom Agent en el proyecto, verifica:
- [ ] El archivo se encuentra en `.agents/agents/<nombre>.md`.
- [ ] El frontmatter YAML abre y cierra con `---`.
- [ ] Contiene `name` y `description` descriptivos en texto claro.
- [ ] Se especifican los flags `mainAgent` y `subagent` según el uso esperado.
- [ ] La lista `tools` incluye únicamente las herramientas necesarias para la tarea.
- [ ] El cuerpo en Markdown contiene instrucciones claras y procedimientos paso a paso.
