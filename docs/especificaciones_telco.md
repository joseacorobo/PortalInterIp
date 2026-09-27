# Especificaciones Técnicas y Reglas de Extracción Telco
## Estándares de Red FTTH / GPON — Inter Telecomunicaciones C.A.

Este documento formaliza las reglas de sintaxis, heurísticas y convenciones operativas utilizadas por el módulo de extracción y procesamiento de requerimientos técnicos (`TelcoEmailParser` / Ingesta de Tickets).

---

## 1. Número de Contrato / Abonado
- **Longitud:** Exactamente 10 dígitos numéricos.
- **Estructura del Permisor:** Los dos (2) primeros dígitos identifican el **Permisor** (zona geográfica o clúster administrativo de Inter, que puede agrupar múltiples ciudades y municipios).
- **Clientes Corporativos:** Manejan el mismo formato numérico y etiqueta de abonado que clientes masivos, diferenciándose por los niveles de servicio (SLA) y prioridad en cola.

---

## 2. Fabricantes de Equipos Terminales de Red (ONU / ONT)
El identificador de serie PON consta de **12 caracteres alfanuméricos** donde los primeros cuatro (4) indican el fabricante:
- **`FHTT` (FiberHome):** Equipos nativos y estándar principal de la red FTTH de Inter.
- **`HWTC` (Huawei):** Equipos comúnmente utilizados en redes Netuno y nodos migrados de Inter.
- **Otros (`STV`, etc.):** Integraciones de terceros o alianzas (ej. SimpleTV).

---

## 3. Nomenclatura Estándar de OLT (Optical Line Terminal)
La sintaxis canónica normalizada para identificar cabeceras y chasis OLT sigue el formato:
```
OLT - [ACRÓNIMO CIUDAD 3-4 LETRAS] - [NÚMERO DE OLT]
```
**Ejemplos:**
- `OLT - CCS - 01` (Caracas 01)
- `OLT - VAL - 02` (Valencia 02)
- `OLT - BQTO - 01` (Barquisimeto 01)

---

## 4. Parámetros de Ubicación en OLT (Slot / PON / MAC)
- **Ubicación Física (Slot / Tarjeta / Puerto PON):** Por lo general, las cuadrillas y técnicos de terreno no envían el slot/puerto en el cuerpo inicial del requerimiento; el sistema toma como clave principal el **Serial PON** (`FHTT...` / `HWTC...`) para consultar el inventario dinámico en la OLT.
- **Dirección MAC:** Generalmente opcional. Las operaciones de aprovisionamiento se realizan mediante el Serial PON, aunque el parser está preparado para capturar la MAC si el técnico la especifica para verificación en capa 2.

---

## 5. Modo de Operación de ONU y Política de Seguridad Crítica
- **Modo Router (Predeterminado):** La ONU gestiona NAT, DHCP y direccionamiento local del abonado.
- **Modo Bridge / IP Certificada:** Requerimiento donde la ONU actúa únicamente como puente transparente y el router o firewall del cliente recibe una IP pública certificada:
  > [!CAUTION]
  > **Restricción Operativa Estricta:** Cuando un ticket corresponde a **Modo Bridge** o **IP Certificada**, el sistema genera una alerta visual mandatoria y **prohíbe el envío de comandos de reprovisionamiento masivo o reaprovisionamiento estándar**, previniendo la pérdida de enrutamiento estático del cliente.

---

## 6. Procedimiento ante Reemplazo de Equipos
- Cuando se realiza un cambio físico de ONT/ONU en el domicilio del cliente por avería, el técnico de campo es responsable de la sustitución física y del reporte del nuevo serial PON.
- El personal de Operaciones IP se encarga de desasociar el serial anterior de la whitelist de la OLT y registrar el nuevo equipo.

---

## 7. Flujo del Correo Corporativo e Ingesta de Casos
- Gran parte de las solicitudes operativas se gestionan por correo corporativo institucional.
- En el departamento IP conviven los buzones funcionales de **Operaciones IP** (`operacionesip@inter.com.ve`) y **Redes de Acceso**, así como los correos nominales de los ingenieros de soporte.
- El módulo de ingesta lee desatendidamente los correos no leídos (`UNSEEN`), parsea los parámetros técnicos descritos arriba y crea el ticket correspondiente en la base de datos vinculándolo a su departamento técnico.
