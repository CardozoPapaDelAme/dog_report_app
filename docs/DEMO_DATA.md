# Datos de demostración (Creel)

Este documento explica cómo cargar, refrescar y retirar los datos de
demostración que se usan para enseñarle la app a un cliente en el proyecto de
staging. Los datos son ficticios, pero están pensados para verse reales: un mapa
público con actividad alrededor de Creel, una gráfica del panel de la Asociación
con datos de todo el último mes y una cola de moderación con reportes por revisar.

## Qué crea

`scripts/demo-seed.sql` inserta **60 reportes** en un radio de unos 6 km del
centro de Creel (plaza y López Mateos, estación del Chepe, templo y mirador del
Cristo Rey, panteón, salida a San Ignacio, Valle de los Hongos, Misión de San
Ignacio, Lago Arareko, carretera a Cusárare, ejido y potreros):

| Estado | Cantidad | Dónde se ve |
|---|---|---|
| `visible` | 52 | Mapa público y panel de la Asociación (últimos 29 días) |
| `pending_review` | 8 | Cola de moderación del Administrador (últimos 3 días) |

| Tipo | Cantidad |
|---|---|
| Avistamiento solitario | 13 |
| Avistamiento en manada | 13 |
| Perro lastimado | 9 |
| Ataque a mascota | 9 |
| Ataque a ganado | 7 |
| Ataque a persona | 5 |
| Otro | 4 |

Cada reporte trae una descripción en español en `details.descripcion`, además de
color, tamaño y collar variados. Las fechas son **relativas al momento en que se
ejecuta el script**: los reportes visibles se reparten entre 0 y 3 por día, y la
hora local de Creel (America/Chihuahua) cae entre las 7:00 y las 22:00. Los visibles
combinan publicación automática por confianza alta con aprobaciones del
Administrador; los pendientes tienen confianza media o baja.

Todos los ids empiezan con el marcador **`de300000-0000-4000-8000-`**. Ese prefijo
es lo único que usa el retiro, así que nunca toca reportes reales ni de prueba.
Los datos están diseñados para no generar candidatos a duplicado entre sí.

## Cargar o refrescar los datos

Ejecuta el contenido de `scripts/demo-seed.sql` como dueño de la base de datos:
en el **SQL Editor de Supabase** del proyecto de staging, o con `psql` conectado
como `postgres`. Es una sola transacción; si algo falla, no queda nada a medias.
Al final muestra un resumen que debe decir `visible = 52` y `pending_review = 8`.

El script se puede volver a correr sin problema. Cada ejecución:

- reescribe los mismos 60 ids con fechas recalculadas a partir de ese momento;
- deshace lo que se haya hecho durante una demo: aprobaciones, ocultamientos,
  banderas y resoluciones de duplicados;
- conserva las fotos ya subidas y ajusta su vencimiento a la nueva ventana pública.

**Vuelve a correrlo antes de cada demo, o al menos una vez al mes.** Como las
fechas son relativas, con el tiempo los reportes salen del rango de 30 días de la
gráfica y, a los 90 días, también del mapa público.

## Subir las fotos

Ocho reportes visibles (01, 06, 10, 16, 17, 19, 21 y 25) esperan foto. Las fotos
están en `assets/demo/photos/` y se suben con la API real, igual que desde la app,
para que el servidor las limpie, las guarde en el bucket privado y las apruebe:

```sh
DEMO_API_URL="https://<project-ref>.supabase.co/functions/v1/api" \
DEMO_API_KEY="<publishable key, opcional>" \
node scripts/demo-photos.mjs
```

- `DEMO_API_URL` es obligatoria. `DEMO_API_KEY` es opcional: la función `api` no
  exige JWT, y si se da, solo viaja como encabezado `apikey`.
- El script llama a `POST /reports/<id>/photo` con el encabezado
  `X-Device-Fingerprint: demo-creel-photo-uploader-2026`. El seed guarda el
  SHA-256 de ese mismo texto como huella de origen de esos ocho reportes.
- Por cada reporte imprime `OK` (subida nueva, HTTP 201), `SAME` (ya estaba,
  HTTP 200) o `FAIL` con el código de error. Se puede repetir sin riesgo.
- `node scripts/demo-photos.mjs --dry-run` solo lista los archivos, sin red.

Sube las fotos dentro de las dos semanas siguientes al seed: la huella de origen
vence 30 días después de la sincronización de cada reporte. Si ya pasó ese
tiempo, vuelve a correr el seed y luego el script de fotos.

## Retirar los datos

Ejecuta `scripts/demo-unseed.sql` en el SQL Editor, también como dueño. El
resumen final muestra cuántas filas demo quedan.

- **Sin fotos subidas**, una sola ejecución borra los 60 reportes y sus filas
  dependientes (fotos, banderas, candidatos y grupos de duplicado).
- **Con fotos subidas**, el script no puede borrar los archivos del bucket:
  Supabase prohíbe `DELETE` directo sobre `storage.objects`. Por eso marca esas
  fotos como `purge_pending` y elimina lógicamente sus reportes, que desaparecen
  de inmediato del mapa, del panel y de la cola de moderación. Los archivos se
  eliminan con alguna de estas opciones; después vuelve a correr
  `scripts/demo-unseed.sql` y el resumen debe quedar en `0 / 0`.
  1. **Tarea de retención (recomendada).** Si ya está programada, basta esperar
     a su siguiente ejecución. Si no, puedes llamarla una vez con
     `POST <DEMO_API_URL>/internal/retention/run` y el encabezado
     `X-Internal-Secret`, que contiene el valor de `INTERNAL_RETENTION_SECRET`
     (ver [`DEPLOYMENT.md`](DEPLOYMENT.md)). Borra cada objeto `purge_pending`
     y lo marca como `purged`.
  2. **Manual.** En el panel de Supabase, en Storage, borra las carpetas
     `reports/de300000-0000-4000-8000-*` del bucket de fotos aprobadas. Después
     márcalas como purgadas con:

     ```sql
     UPDATE public.photo_assets
     SET state = 'purged', approved_object_path = NULL, purged_at = now()
     WHERE report_id::text LIKE 'de300000-0000-4000-8000-%'
       AND state = 'purge_pending';
     ```

Limitaciones conocidas:

- Las acciones de moderación hechas durante una demo quedan en `audit_log`, que
  solo admite inserciones. El retiro no las borra.
- No vuelvas a correr el seed entre las dos ejecuciones del retiro: los reportes
  regresarían como visibles, pero sus fotos ya estarían en purga.
- Si en staging ya hay otros reportes cerca de Creel con fechas parecidas, el
  detector de duplicados puede sugerir parejas entre esos reportes y los de demo.
  Son solo sugerencias y el retiro las elimina.

## Verificación automática

`npm run test:postgres -- demoSeed` levanta un PostgreSQL/PostGIS desechable,
aplica las migraciones y comprueba los conteos, las fechas, la visibilidad en el
mapa y en el panel, la huella de las fotos, la idempotencia del seed y el retiro
completo sin tocar reportes ajenos a la demo.

## Créditos de las fotos

Las ocho fotos son de Unsplash, bajo la Licencia Unsplash. Autores y enlaces en
[`assets/demo/photos/CREDITS.md`](../assets/demo/photos/CREDITS.md).
