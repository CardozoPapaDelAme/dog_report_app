# Manual de usuario

Estado: esqueleto (D0, TD-138). Responsables: D6 (TD-144, reportero público) y D7
(TD-145, personal autorizado, introducción, prerrequisitos y FAQ). Guía completa:
[`docs/deployment/BACKLOG.md`](docs/deployment/BACKLOG.md), D6 y D7.

Escrito para usuarios no técnicos: los textos de los botones van tal como aparecen
en la app (`i18n/locales/es.json`). Capturas en `docs/manuals/img/`.

## 1. Introducción

_Pendiente (D7)_

## 2. Vistazo general

Fuentes: `docs/architecture/OVERVIEW.md` ("Actor boundaries"), `docs/GLOSSARY.md`.

_Pendiente (D7): qué hace la app, los tres tipos de usuario y el mapa de pantallas._

## 3. Prerrequisitos

_Pendiente (D7)_

## 4. Funciones — Reportero público

Formato por función: **Descripción** · **Pantalla(s)** · **Elementos de la
pantalla** (tabla elemento → para qué sirve) · **Cómo se utiliza** (pasos).

Fuentes: `screens/CameraScreen.js`, `screens/ReportDraftScreen.js`,
`screens/ReportFormScreen.js`, `screens/PublicMapScreen.js`,
`docs/diagrams/sequences/creacionreportes.md`,
`docs/diagrams/sequences/Mapareportes.md`,
`docs/diagrams/sequences/detallezonacondenuncia.md`, `docs/testing/ALPHA.md`;
capturas de referencia en `promo-video/material/`.

### 4.1 Tomar la foto y validarla

_Pendiente (D6)_

### 4.2 Reportar sin foto

_Pendiente (D6)_

### 4.3 Llenar y enviar el reporte

_Pendiente (D6)_

### 4.4 Borradores y envío sin conexión

_Pendiente (D6)_

### 4.5 Consultar el mapa

_Pendiente (D6)_

### 4.6 Ver el detalle de una zona o reporte

_Pendiente (D6)_

### 4.7 Denunciar un reporte

_Pendiente (D6)_

## 5. Funciones — Personal autorizado

Mismo formato que la sección 4.

Fuentes: `screens/loginScreen.js`, `screens/associationDashboardScreen.js`,
`screens/AdminDataExportScreen.js`, `screens/CommandCenterScreen.js`,
`screens/ConfigurationScreen.js`, `screens/ZoneSetScreen.js`,
`screens/DuplicateManagementScreen.js`, `docs/SECURITY.md` ("Role matrix"),
`docs/diagrams/sequences/Login.md`,
`docs/diagrams/sequences/dashboardasociacion.md`,
`docs/diagrams/sequences/commandcenter.md`,
`docs/diagrams/sequences/admin-moderation.md`,
`docs/diagrams/sequences/gestionduplicados-conservarreporte.md`,
`docs/diagrams/sequences/fusionarreporte.md`.

### 5.1 Acceso de personal (iniciar y cerrar sesión)

_Pendiente (D7)_

### 5.2 Panel de la Asociación

_Pendiente (D7)_

### 5.3 Exportar reportes (CSV/Excel)

_Pendiente (D7)_

### 5.4 Command Center (Administrator)

_Pendiente (D7)_

### 5.5 Moderación de reportes

_Pendiente (D7)_

### 5.6 Configuración de umbrales

_Pendiente (D7)_

### 5.7 Zonas

_Pendiente (D7)_

### 5.8 Duplicados

_Pendiente (D7)_

## 6. Preguntas frecuentes (F.A.Q.)

Fuente de dudas reales: `docs/testing/UAT.md`.

_Pendiente (D7): mínimo 10 preguntas._
