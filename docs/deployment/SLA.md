# Acuerdo de nivel de servicio (SLA)

Estado: esqueleto (D0, TD-138). Responsable: D4 (TD-142). Guía completa de la tarea:
[`docs/deployment/BACKLOG.md`](docs/deployment/BACKLOG.md), D4.

Sistema en Fase 1 sobre Supabase managed Free: el proveedor no ofrece SLA en este
plan. Los compromisos de este documento son del equipo, con las exclusiones
indicadas (RNF01: el 99.9 % es meta futura).

## Resumen

| Compromiso | Objetivo | Medición | Evidencia |
|---|---|---|---|
| Tiempo de respuesta de funciones críticas | _Pendiente (D4)_ ms | | |
| Disponibilidad | 80 % mensual (≈ 292 días/año) | | |
| Capacidad | _Pendiente (D4)_ usuarios simultáneos | | |
| Privacidad | No se almacenan datos personales | | |
| Respaldo | Cada 7 días | | |
| Respuesta a incidentes | 24 horas | | |

## 1. Tiempo de respuesta de funciones críticas

Fuentes: `docs/testing/NON-FUNCTIONAL.md` (TC-NF-02, TC-NF-03),
`tests/load/public-read.js`.

_Pendiente (D4): funciones críticas, p50/p95 en ms, objetivo, exclusiones._

## 2. Disponibilidad

Fuentes: `docs/deployment/MONITORING.md`, `docs/DEPLOYMENT.md`.

_Pendiente (D4)_

## 3. Capacidad

_Pendiente (D4)_

## 4. Privacidad

Fuentes: `docs/SECURITY.md` ("Anonymous integrity and privacy", "Location
privacy"), RF02 y RNF13 en `docs/product/ETAPA1-REQUERIMIENTOS-V2.md`.

_Pendiente (D4)_

## 5. Respaldo

Fuentes: `docs/deployment/BACKUP-LOG.md`, RNF14 y RNF18.

_Pendiente (D4)_

## 6. Respuesta a incidentes

Fuentes: `docs/testing/INCIDENTS.md` (severidades), `docs/DEPLOYMENT.md`
("Incident priorities").

| Severidad | Primera respuesta | Solución objetivo | Ejemplo |
|---|---|---|---|
| Crítica | _Pendiente (D4)_ | | |
| Alta | | | |
| Media | | | |
| Baja | | | |

## Vigencia y revisión

_Pendiente (D4)_
