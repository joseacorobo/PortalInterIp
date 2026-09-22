# Reporte Seed Masivo — Portal de Operaciones IP

**Fecha de ejecución:** 2026-09-21  
**Script:** `app/seed.py`  
**Base de datos:** `app/ip_ops.db` (SQLite local)

---

## Resumen de Volumen Generado

| Entidad | Registros |
|---|---|
| Usuarios operativos | 14 |
| Departamentos | 6 |
| Tipos de tarea (P1-P5) | 31 |
| **Tickets históricos (RESUELTO)** | **500** |
| **Tickets activos** | **45** |
| Task logs históricos | 500 |
| **Total email_tickets** | **545** |

---

## Distribución de Tickets Históricos

### Por Área
| Área | Tickets |
|---|---|
| Cabecera | 190 |
| Telefonía | 185 |
| Soporte | 170 |

### Rango de Fechas
- **Desde:** 2026-08-22 (≈ 30 días atrás)
- **Hasta:** 2026-09-20

---

## Tickets Activos (45 total)

| Área | PENDIENTE | EN PROGRESO | EN ESPERA |
|---|---|---|---|
| Soporte | 7 | 6 | 6 |
| Cabecera | 3 | 6 | 3 |
| Telefonía | 3 | 9 | 2 |
| **Total** | **13** | **21** | **11** |

---

## Distribución de Complejidad en Históricos

| Nivel | Pts/ticket | Tickets | % |
|---|---|---|---|
| P1 (Básico) | 1 | 115 | 23% |
| P2 (Simple) | 2 | 109 | 21.8% |
| P3 (Moderado) | 3 | 116 | 23.2% |
| P4 (Complejo) | 5 | 100 | 20% |
| P5 (Crítico) | 8 | 60 | 12% |

---

## Productividad por Operador (task_logs)

| Operador | Área | Puntos Acumulados | Tickets |
|---|---|---|---|
| Gabriel Torres | Cabecera | 182 | 50 |
| Luis Eduardo Gómez | Cabecera | 182 | 52 |
| Daniela Castillo | Telefonía | 152 | 50 |
| Víctor Hernández | Telefonía | 147 | 40 |
| Jesús Alberto Vargas | Telefonía | 144 | 46 |
| Ricardo Morales | Cabecera | 139 | 38 |
| Alejandro Silva | Cabecera | 131 | 38 |
| Anais Rodríguez | Soporte | 129 | 38 |
| Mariana Salazar | Soporte | 120 | 46 |
| Carlos Méndez | Soporte | 119 | 33 |
| Paola Mendoza | Telefonía | 115 | 35 |
| José Gregorio Pérez | Soporte | 101 | 34 |

---

## Características del Dataset

- **SLA variable:** Tiempo de resolución con distribución gaussiana (μ=sla_minutes, σ=25%)
- **MTTR realista:** duracion_atencion_minutos y tiempo_espera_minutos distintos por nivel
- **Integridad referencial:** Todos los FK a users, task_types y departamentos son válidos
- **Sin duplicados:** Cada ticket_code es único (INC-40000 a INC-40544)
- **Reproducible:** random.seed(42) garantiza resultados idénticos en cada ejecución
- **Campos de auditoría:** fecha_creacion, fecha_inicio_atencion, fecha_cierre poblados en históricos

---

## Estado Final del Sistema

- Dashboard listo para rendir métricas históricas
- Gráficos de carga de trabajo con datos reales
- Exportación Excel operativa con datos significativos
- Endpoint /api/metrics/workload con 21 tickets EN PROGRESO distribuidos
