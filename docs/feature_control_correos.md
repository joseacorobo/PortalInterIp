==ENFOQUE PARA LA CREACION DE TICKETS / PARA DISTRIBUIR LA CARGA DE TRABAJO======

# Funcionalidad: Control de Correos y Carga de Trabajo (Helpdesk IP)

## Objetivo
El sistema no será un cliente de correo web. En su lugar, registrará los correos entrantes como "Tickets" o "Casos" para poder asignar responsables, medir tiempos de respuesta y evaluar la carga de trabajo del departamento IP.

## Flujo de Trabajo
1. Llega un requerimiento (representado como un registro en la base de datos).
2. Se asigna a un "Operador" de un "Departamento/Área".
3. El ticket cambia de estado (Pendiente -> En Proceso -> Resuelto).
4. Se registra la fecha de inicio y la fecha de cierre para generar métricas.

## Entidades Principales (Base de Datos)
- Usuarios (Operadores del dpto IP)
- Departamentos "Areas" (Redes de Acceso y Aprovisionamiento, Control de Trafico e Redes inalambricas, Seguridad,Telefonia,Redes WAN,Grandes Clientes).
- Tickets (ID del correo/caso, Asunto, Descripción, Estado, Asignado_A, Fecha_Creación, Fecha_Cierre)
