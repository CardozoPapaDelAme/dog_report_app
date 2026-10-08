# Datos y evidencias de prueba

Cada fixture debe indicar propósito, origen (sintético o anonimizado), casos que
lo usan, entradas exactas, versión del contrato y limitaciones. Usar nombres
estables: `docs/testing/data/<modulo>-<escenario>.json` o `.md`.
Evidencias: `docs/testing/data/evidence/<ejecucion>-<descripcion>.<extension>`;
crear ese directorio cuando exista evidencia real. También se admiten enlaces
persistentes a artefactos de CI o a almacenamiento compartido autorizado.

`docs/testing/data/example-pack-count.json` contiene entradas sintéticas para el
ejemplo de `docs/testing/cases/TEMPLATE.md`. Es material didáctico de validación
local, no datos de reportes reales, geometría oficial ni resultados ejecutados.

## Ficha para nuevos datos

| Campo | Valor |
|---|---|
| Archivo | <ruta completa desde raíz> |
| Propósito y origen | <qué verifica; sintético/anonimizado> |
| Casos | <TC-módulo-n> |
| Contrato y versión | <ruta, sección y commit> |
| Preparación y limpieza | <pasos reproducibles> |
| Limitaciones | <mocks, campos omitidos, alcance> |

No incluir credenciales, tokens, datos personales ni EXIF crudo.
