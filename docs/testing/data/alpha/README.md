# Evidencia de la prueba alfa (T7)

Aquí se guardan las capturas, videos y archivos exportados de las sesiones de
`docs/testing/ALPHA.md`. La sesión alfa Android de T7 quedó registrada en
`2026-10-11/` con evidencias para TC-ALPHA-01 a TC-ALPHA-33.

## Estructura y nombres

```text
docs/testing/data/alpha/
  2026-10-DD/
    TC-ALPHA-03-foto-nitida.png
    TC-ALPHA-16-sincronizacion.mp4
    TC-ALPHA-27-export-csv.csv
```

- Una carpeta por fecha de sesión; el nombre del archivo empieza por el ID del caso.
- Enlazar cada archivo desde la fila `RUN-n` de `docs/testing/TEST_LOG.md` y desde
  la columna «Captura/video» de `docs/testing/ALPHA.md`, con la ruta completa desde
  la raíz del repo.
- Videos pesados: subirlos a un enlace persistente con acceso del equipo y anotar
  la URL en lugar de versionar el archivo.

## Qué no subir

- Credenciales, tokens, correos o contraseñas, ni siquiera parcialmente visibles.
- Datos personales, placas, domicilios o personas identificables en las fotos.
- EXIF crudo: los archivos exportados deben contener solo datos sintéticos de
  prueba.
