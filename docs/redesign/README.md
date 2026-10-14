# Rediseño visual (TD-132, TD-133, TD-134)

Índice de esta carpeta. Es documentación de trabajo del rediseño; **no gobierna producto ni contratos** (ver la jerarquía en [`../README.md`](../README.md)). El sistema visual vigente es [`../design/DESIGN.md`](../design/DESIGN.md).

| Documento | Qué es | Estado |
|---|---|---|
| [`TASTE.md`](TASTE.md) | Qué se aprobó y se rechazó por pantalla y las reglas numeradas para las siguientes | **Vigente**, vivo |
| [`CONTRACT.md`](CONTRACT.md) | Lo que las pruebas Playwright fijan (testID, roles, textos, estructura) y los cambios hechos a `tests/` | **Vigente** |
| [`INVENTORY.md`](INVENTORY.md) | Pantallas y componentes × cobertura | **Vigente** |
| [`AUDIT.md`](AUDIT.md) | Auditoría previa al rediseño y plan, con el estado al cierre | Histórico + cierre |
| [`BASELINE.md`](BASELINE.md) | Línea base de pruebas en `main` y estado final | Histórico + estado final |
| [`NOTAS_PASADA1.md`](NOTAS_PASADA1.md) | Mediciones del código antes del rediseño | Histórico |
| [`CAPTURAS_PENDIENTES.md`](CAPTURAS_PENDIENTES.md) | Capturas que pidió la auditoría | Cerrado |

## Capturas

- `before/web/{es,en}/`: capturas web del estado anterior. `before/manual/`: capturas del iPhone (en inglés) de la auditoría.
- `after/web/`: capturas web posteriores al rediseño, en español (`es_*`) y algunas en inglés (`en_*`). Son del fixture web con datos ficticios, **no** del dispositivo.
- Regenerar una captura: `CAPTURE_SPEC=<archivo>.spec.js npx playwright test -c docs/redesign/capture/playwright.capture.config.mjs` (los guiones están en `capture/`, p. ej. `after-command.spec.js`, `after-pins.spec.js`). Las pruebas de verdad están en `tests/ui/`.

## Cómo se verifica

1. `npx playwright test`: la suite de UI (109 pruebas al cierre de TD-134). Corre contra el arnés web, que **no ve** lo que depende de la capa nativa de React Native.
2. En el iPhone (build de desarrollo): superposiciones, teclado, hojas apiladas, bordes de pantalla y el mapa real. Es donde aparecieron todos los fallos que la web no mostraba.
3. Antes de editar: leer `CONTRACT.md`; después de un cambio visual, regenerar la captura de la pantalla y revisarla.
