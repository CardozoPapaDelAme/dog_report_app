# Secuencia: mapa público de reportes

El mapa es online y consume exclusivamente proyecciones públicas de la API Hono.
Las ubicaciones individuales y agregadas usan la misma aproximación métrica,
estable y determinista de 50 m.

```mermaid
sequenceDiagram
  actor Reporter as anonymous public reporter
  participant App as Aplicación React Native
  participant C as PublicMap Controller
  participant S as PublicMapService
  participant R as PublicMapRepository
  participant DB as PostgreSQL / PostGIS / RLS
  participant P as JSON Presenter

  Reporter->>App: Abre o desplaza el mapa
  alt Dispositivo sin conexión
    App-->>Reporter: Muestra que el mapa no está disponible sin conexión
  else Dispositivo con conexión
    App->>C: GET /public/clusters con zoom y viewport completo
    C->>S: listClusters(query, actor público)
    S->>DB: BEGIN, SET LOCAL app.role=anonymous
    S->>R: Consultar reportes visibles, vigentes y canónicos
    R->>DB: SELECT parametrizado y clustering métrico
    DB-->>R: Conteos, severidad y centroides aproximados
    R-->>S: Clusters de dominio
    S->>DB: COMMIT
    S->>P: ClusterView[]
    P-->>App: 200 data=ClusterView[]
    App-->>Reporter: Renderiza tamaño, severidad y seis conteos por tipo

    opt El zoom llega al nivel de pines individuales
      App->>C: GET /public/reports con since y limit
      C->>S: listReports(query, actor público)
      S->>DB: BEGIN, SET LOCAL app.role=anonymous
      S->>R: Consultar reportes públicos recientes
      R->>DB: SELECT parametrizado bajo RLS
      DB-->>R: Solo visibles, vigentes y canónicos
      S->>DB: COMMIT
      S->>P: PublicReportView[]
      P-->>App: 200 data=PublicReportView[]
      App-->>Reporter: Muestra pines con ubicación aproximada
    end
  end
```

## Rutas y privacidad

| Ruta | Uso | Exclusiones obligatorias |
|---|---|---|
| `GET /public/clusters?zoom=<0..22>&min_longitude=&min_latitude=&max_longitude=&max_latitude=&limit=<1..5000>` | Clusters del viewport; los cuatro límites se envían juntos o se omiten | Coordenadas exactas, rutas privadas y miembros no canónicos |
| `GET /public/reports?since=<timestamp>&limit=<1..1000>` | Pines públicos recientes | Coordenadas exactas, campos privados y reportes no visibles, vencidos o no canónicos |

Las rutas públicas no requieren `Authorization`; un token suministrado pero
inválido produce `401 invalid_token` y nunca se degrada a acceso anónimo.

## Fuentes

- [`../../API.md`](../../API.md): consultas públicas y formas `ClusterView`/`PublicReportView`.
- [`../../DATA-MODEL.md`](../../DATA-MODEL.md): clustering métrico, severidad y aproximación de 50 m.
- [`../../SECURITY.md`](../../SECURITY.md): minimización y protección contra triangulación.
