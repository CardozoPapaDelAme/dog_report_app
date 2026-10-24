# Monitoreo de infraestructura

Estado: esqueleto. Tarea: D3. Guía completa de la tarea:
[`docs/deployment/BACKLOG.md`](docs/deployment/BACKLOG.md), D3. Cubre RNF25.

Capturas en `docs/deployment/img/`, sin claves, correos ni IDs sensibles.

## 1. Dashboards de Supabase

Fuentes: `docs/DEPLOYMENT.md` ("Managed Free planning assumptions", "Retention and
monitoring").

| Dashboard | Qué muestra | Umbral de alerta | Acción | Captura |
|---|---|---|---|---|
| Usage (BD, Storage, egress, invocaciones) | | | | _Pendiente (D3)_ |
| Edge Functions → `api` | | | | |
| Database (Query Performance, conexiones) | | | | |
| Auth | | | | |

## 2. Monitor de disponibilidad (UptimeRobot)

_Pendiente (D3): monitores, intervalo, palabra clave, contactos de alerta y enlace
a la página de estado pública._

## 3. Health check en Python

Fuentes: `examples/python_health/README.md`, `examples/python_health/app.py`,
`examples/python_health/test_health.py`.

_Pendiente (D3): endpoints revisados, umbrales, formato de respuesta, despliegue y
URL pública._

## 4. Qué se monitorea (RNF25)

| Señal | Herramienta | Frecuencia | Umbral | Responsable |
|---|---|---|---|---|
| Cuotas Free | | | | _Pendiente (D3)_ |
| Errores de la API | | | | |
| Latencia | | | | |
| Conexiones a PostgreSQL | | | | |
| Pausa del proyecto | | | | |
| Retención y scheduler | | | | |
| Antigüedad de la última exportación | | | | |
| Volumen de auditoría | | | | |

## 5. Procedimiento de alerta

Fuentes: `docs/DEPLOYMENT.md` ("Incident priorities"), `docs/deployment/SLA.md`.

_Pendiente (D3)_
