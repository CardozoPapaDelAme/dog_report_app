# Línea base de pruebas (antes del rediseño)

> **Histórico.** Es la línea base de `main` antes de TD-134. Estado actual de la rama de rediseño: ver la sección "Estado al final de TD-134" al pie.

Fecha: 2026-10-13 · rama `main` · árbol limpio al iniciar (commit `1bb7b5b`).

| Suite | Comando | Resultado |
|---|---|---|
| Rutas documentales | `npm run test:docs` | OK — 69 archivos, 1131 citas, 0 errores |
| Node (`node:test`) | `npm run test:node` | OK — 18 pasan, 0 fallan |
| Deno (móvil + backend) | `npm run test:deno` | **FALLA ya antes del rediseño**: `TS2307 Import "@supabase/supabase-js" not a dependency and not in import map` (`services/authService.js:70`) → "Type checking failed". Es de resolución de tipos de Deno, no de UI. No se probó con `--no-check`. |
| Playwright UI (todas) | `npx playwright test` | OK — **88 pasan, 0 fallan** (1.0 min, 1 worker, 390×844, `es-MX`) |
| PostgreSQL | `npm run test:postgres` | No se corrió (requiere `*_TEST_DATABASE_URL`) |
| Carga | `tests/load/public-read.js` | No se corrió (no es parte de la suite UI) |

Los scripts `test:*-ui` son subconjuntos de `npx playwright test`; no se repitieron por separado.

Conclusión: la única falla preexistente es Deno (tipos de `@supabase/supabase-js`). Todo lo que toca el rediseño (Playwright) está en verde, por lo que cualquier fallo nuevo será atribuible al rediseño.

## Estado al final de TD-134

Rama `TD-134-JP-rediseno-paso0`, medido con `npm test`:

| Suite | Resultado |
|---|---|
| Rutas documentales | OK |
| `node:test` | OK, 18 pasan |
| Playwright UI | OK, **109 pasan, 0 fallan** (88 de la línea base + 21 nuevas, ninguna de las 88 se eliminó) |
| Deno (móvil + backend) | **Sigue fallando por lo mismo** que en `main`: `TS2307` en `services/authService.js`. Verificado con y sin los cambios de la rama; no es del rediseño ni se tocó |

