-- ============================================================================
-- Esquema de base de datos — App de Reportes de Perros Callejeros (Creel)
-- Asociación de Hoteles de Chihuahua, A.C.
-- ----------------------------------------------------------------------------
-- Motor:         PostgreSQL + PostGIS
-- Despliegue:    Supabase self-hosted (Docker) sobre VPS OVHcloud, vía Dokploy
-- Referencia:    SRS "Etapa 1. Requerimientos" — RF01-RF24, RNF01-RNF36
-- Versión:       3  (agrega formulario dinámico: columna details JSONB con
--                    validación de estructura por tipo de incidente.
--                    v2: atributos del perro, motivo 'no_es_callejero', duplicados)
-- ----------------------------------------------------------------------------
-- NOTA DE DOCUMENTACIÓN:
--   Este archivo usa dos niveles de documentación:
--   1) Comentarios de línea (--) que explican el PORQUÉ de cada decisión.
--   2) Sentencias COMMENT ON (al final de cada bloque) que registran el
--      "docstring" de cada tabla/columna DENTRO de la base de datos. Estos
--      quedan consultables vía \d+ en psql, en Supabase Studio, o con
--      SELECT obj_description()/col_description(). Son la forma nativa de
--      Postgres de documentar un esquema de forma persistente.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Extensiones
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;    -- Tipos y funciones geoespaciales (RNF09, RF10-RF14)
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- FASE 2 (RNF35) — NO habilitar en el prototipo:
-- La re-identificación visual de perros individuales (embeddings DINOv2 +
-- búsqueda por similitud) requeriría la extensión pgvector y capacidad de
-- cómputo superior a la del VPS actual (4 vCPU / 8 GB RAM). Queda documentada
-- como evolución futura, fuera del alcance del prototipo.
-- CREATE EXTENSION IF NOT EXISTS vector;


-- ----------------------------------------------------------------------------
-- 1. Tipos ENUM
--    Se usan ENUM (no tablas catálogo) porque estos conjuntos de valores están
--    cerrados en los requerimientos y Postgres rechaza cualquier valor fuera
--    de la lista automáticamente (integridad de datos sin lógica extra).
-- ----------------------------------------------------------------------------

-- Tipos de incidente/avistamiento (RF06).
CREATE TYPE incident_type AS ENUM (
  'avistamiento_simple',
  'ataque_mascota',
  'ataque_ganado',
  'ataque_humano',
  'perro_lastimado',
  'otro'
);

-- Clasificación del avistamiento (RF04).
CREATE TYPE sighting_type AS ENUM ('solitario', 'manada');

-- Estado de moderación de un reporte (RF19-RF21).
CREATE TYPE report_status AS ENUM ('visible', 'oculto', 'eliminado');

-- Causa del ocultamiento — separada de 'status' para poder preguntar
-- "¿está oculto?" sin importar la causa, y "¿por qué?" cuando importa (RF20/RF21).
CREATE TYPE hidden_reason AS ENUM ('umbral_denuncias', 'accion_administrador');

-- Rol de las cuentas autenticadas. Solo 2 roles + acceso anónimo (RNF07).
CREATE TYPE user_role AS ENUM ('asociacion', 'administrador');

-- Motivos por los que un usuario puede denunciar un reporte (RF08).
-- 'no_es_callejero' (v2): distingue el falso positivo "es una mascota con
-- dueño" del troll/foto falsa, porque contamina las estadísticas de forma
-- distinta y conviene medirlo por separado.
CREATE TYPE flag_reason AS ENUM (
  'foto_falsa',
  'contenido_inapropiado',
  'burla',
  'no_es_callejero',
  'otro'
);

-- Acciones administrativas auditables sobre un reporte (RNF33).
CREATE TYPE audit_action AS ENUM ('ocultar', 'eliminar', 'restaurar');

-- Tamaño aproximado del perro (RF22) — entrada MANUAL y opcional del usuario.
-- No se infiere automáticamente: una sola foto no da escala real confiable.
CREATE TYPE dog_size AS ENUM ('chico', 'mediano', 'grande');

-- Estado de un grupo de posibles duplicados en la cola de revisión (RF23).
CREATE TYPE duplicate_status AS ENUM ('pendiente', 'confirmado', 'descartado');


-- ----------------------------------------------------------------------------
-- 2. profiles — perfil de las 2 cuentas autenticadas (RF15, RF18, RNF07)
--    No se modifica auth.users (territorio de Supabase/GoTrue); se extiende
--    con esta tabla propia ligada por FK. 1 fila = Asociación, 1 = Administrador.
-- ----------------------------------------------------------------------------
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role NOT NULL,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  profiles              IS 'Perfil de negocio de las cuentas autenticadas (Asociación y Administrador). Extiende auth.users de Supabase sin modificarla. No hay auto-registro: ambas cuentas se aprovisionan manualmente (RNF07).';
COMMENT ON COLUMN profiles.id           IS 'FK a auth.users(id) de Supabase. Identidad de la cuenta.';
COMMENT ON COLUMN profiles.role         IS 'Rol de la cuenta: asociacion (ve stats/BI y exporta) o administrador (modera reportes).';
COMMENT ON COLUMN profiles.display_name IS 'Nombre visible del operador de la cuenta. Dato personal — tratado bajo LFPDPPP (RNF13).';


-- ----------------------------------------------------------------------------
-- 3. zones — polígono geográfico de Creel (RNF09)
--    Se guarda como fila (no como constante en código) para poder ajustar el
--    límite sin re-desplegar la app, y porque la zona es un ATRIBUTO de datos,
--    no una frontera de tenant (RNF07).
-- ----------------------------------------------------------------------------
CREATE TABLE zones (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  boundary  GEOGRAPHY(POLYGON, 4326) NOT NULL,
  active    BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE  zones          IS 'Polígono(s) geográfico(s) que delimitan la zona válida para reportes (Creel). Usado por el trigger de validación y por el geofencing (RNF09).';
COMMENT ON COLUMN zones.boundary IS 'Polígono en WGS84 (SRID 4326, el mismo sistema del GPS de los celulares).';
COMMENT ON COLUMN zones.active   IS 'Permite desactivar una zona sin borrarla. Solo las zonas activas validan reportes.';

-- TODO: reemplazar con las coordenadas reales del polígono turístico de Creel.
-- INSERT INTO zones (name, boundary) VALUES ('Creel - Zona Turística', ST_GeogFromText('POLYGON((...))'));


-- ----------------------------------------------------------------------------
-- 4. app_settings — parámetros configurables en tiempo de ejecución
--    Viven en BD (no en código) porque los requerimientos piden que sean
--    "configurables" (RF21/HU-21) sin necesidad de re-desplegar.
-- ----------------------------------------------------------------------------
CREATE TABLE app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app_settings IS 'Parámetros configurables del sistema (umbrales de moderación y de detección de duplicados). Editables sin re-desplegar.';

INSERT INTO app_settings (key, value) VALUES
  ('flag_auto_hide_threshold', '5'),     -- RF21/HU-21: nº de denuncias que dispara auto-ocultamiento
  ('gps_accuracy_max_meters',  '50'),    -- RNF09: precisión GPS máxima aceptada (metros)
  ('dup_radius_meters',        '150'),   -- RF23: radio para considerar dos reportes como posible duplicado
  ('dup_time_window_minutes',  '120');   -- RF23: ventana temporal para posible duplicado


-- ----------------------------------------------------------------------------
-- 5. reports — tabla principal (RF01-RF09, RF22)
-- ----------------------------------------------------------------------------
CREATE TABLE reports (
  -- Identidad. UUID generado EN EL CLIENTE para soportar offline-first (RNF12):
  -- el reporte tiene su ID final desde que se crea, con o sin conexión.
  id                            UUID PRIMARY KEY,

  -- Ubicación y validación geográfica (RF06, RNF09).
  location                      GEOGRAPHY(POINT, 4326) NOT NULL,
  gps_accuracy_meters           NUMERIC(6,2),
  mock_location_suspected       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Contenido del reporte.
  photo_url                     TEXT,               -- nullable: RF05 permite reporte SIN foto
  incident_type                 incident_type NOT NULL,
  sighting_type                 sighting_type NOT NULL,

  -- Formulario dinámico (Alcance del proyecto): respuestas condicionales que
  -- varían según incident_type. Los campos universales son columnas reales;
  -- las respuestas específicas de cada tipo de incidente viven aquí como JSON.
  -- La ESTRUCTURA está documentada y validada por tipo (ver fn_validate_report_details
  -- y el documento docs/DATA-MODEL.md). No es un campo libre: cada tipo
  -- tiene un conjunto de claves esperadas.
  details                       JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Atributos visuales del perro (RF22, v2).
  -- color: extraído automáticamente on-device por análisis de píxeles (barato, sin IA pesada).
  -- tamano/tiene_collar: entrada MANUAL y opcional del usuario (no se infieren).
  -- tiene_collar nullable = cubre "no sé" y los reportes sin foto.
  color_predominante            TEXT,
  tamano                        dog_size,
  tiene_collar                  BOOLEAN,

  -- Estado y moderación (RF08, RF19-RF21).
  status                        report_status NOT NULL DEFAULT 'visible',
  hidden_reason                 hidden_reason,
  hidden_at                     TIMESTAMPTZ,

  -- Anti-abuso (RNF26-RNF29).
  device_fingerprint            TEXT NOT NULL,
  exif_metadata                 JSONB,              -- estructura variable según el celular

  -- Puntaje de confianza DESGLOSADO (RNF28): se guarda cada factor por separado
  -- para poder auditar/ajustar el algoritmo (saber QUÉ factor bajó el score).
  -- SEGURIDAD: estos valores NO deben confiarse tal cual del cliente; deben
  -- recalcularse server-side (trigger o Edge Function) para evitar que un
  -- cliente malicioso se autoasigne un score alto.
  confidence_score              NUMERIC(4,3) CHECK (confidence_score BETWEEN 0 AND 1),
  confidence_photo_score        NUMERIC(4,3),
  confidence_exif_score         NUMERIC(4,3),
  confidence_gps_score          NUMERIC(4,3),
  confidence_fingerprint_score  NUMERIC(4,3),

  -- Offline-first (RNF12): dos timestamps distintos.
  client_created_at             TIMESTAMPTZ NOT NULL,               -- cuándo ocurrió el avistamiento (reloj del dispositivo)
  synced_at                     TIMESTAMPTZ NOT NULL DEFAULT now()  -- cuándo lo recibió el servidor

  -- FASE 2 (RNF35): aquí iría la columna de embedding visual para
  -- re-identificación con DINOv2. Requiere la extensión pgvector.
  -- , embedding vector(384)
);

CREATE INDEX idx_reports_location    ON reports USING GIST (location);  -- clave para clustering en tiempo real
CREATE INDEX idx_reports_status      ON reports (status);
CREATE INDEX idx_reports_synced_at   ON reports (synced_at);
CREATE INDEX idx_reports_fingerprint ON reports (device_fingerprint);

COMMENT ON TABLE  reports                              IS 'Reportes de avistamientos de perros callejeros. Núcleo del sistema. Insertable de forma anónima (RF01); no contiene datos personales del reportante (RNF13), solo un fingerprint anónimo de dispositivo.';
COMMENT ON COLUMN reports.id                           IS 'UUID generado en el cliente para soportar creación offline (RNF12): identidad estable con o sin conexión.';
COMMENT ON COLUMN reports.location                     IS 'Coordenada del avistamiento (WGS84). Validada contra zones por trigger (RNF09).';
COMMENT ON COLUMN reports.gps_accuracy_meters          IS 'Precisión reportada del GPS en metros. Reportes por encima del umbral (app_settings.gps_accuracy_max_meters) se marcan/descartan (RNF09).';
COMMENT ON COLUMN reports.mock_location_suspected      IS 'TRUE si el dispositivo reportó ubicación simulada (mock location / GPS spoofing). Mitiga "manipulación deliberada de ubicación" de la matriz de riesgos.';
COMMENT ON COLUMN reports.photo_url                    IS 'URL de la foto en Supabase Storage. NULL cuando es un reporte rápido sin foto (RF05).';
COMMENT ON COLUMN reports.details                       IS 'Respuestas condicionales del formulario dinámico, según incident_type (Alcance del proyecto). Estructura documentada y validada por fn_validate_report_details. Ej.: para ataque_ganado incluye tipo_animal y cantidad_afectada. Ver docs/DATA-MODEL.md.';
COMMENT ON COLUMN reports.color_predominante           IS 'Color dominante del perro, extraído on-device por análisis de píxeles (RF22). No requiere IA pesada.';
COMMENT ON COLUMN reports.tamano                       IS 'Tamaño aproximado (chico/mediano/grande). Entrada MANUAL y opcional del usuario (RF22); no se infiere automáticamente.';
COMMENT ON COLUMN reports.tiene_collar                 IS 'Indica si el perro trae collar (RF22). Señal de que podría ser una mascota, no un callejero. NULL = "no sé" o reporte sin foto.';
COMMENT ON COLUMN reports.status                       IS 'Estado de moderación: visible / oculto / eliminado (RF19-RF21).';
COMMENT ON COLUMN reports.hidden_reason                IS 'Por qué se ocultó: umbral_denuncias (automático, RF21) o accion_administrador (manual, RF20).';
COMMENT ON COLUMN reports.device_fingerprint           IS 'Identificador anónimo del dispositivo para rate limiting anti-abuso (RNF26). Preferido sobre IP por el WiFi compartido de hoteles. NO identifica a la persona.';
COMMENT ON COLUMN reports.exif_metadata                IS 'Metadatos EXIF de la foto (JSONB por estructura variable). Usado para coherencia de tiempo/lugar en el score de confianza (RNF28).';
COMMENT ON COLUMN reports.confidence_score             IS 'Puntaje de confianza final [0-1] (RNF28). DEBE recalcularse server-side; no confiar en el valor del cliente.';
COMMENT ON COLUMN reports.confidence_photo_score       IS 'Componente del score: validez de la foto (perro detectado / calidad).';
COMMENT ON COLUMN reports.confidence_exif_score        IS 'Componente del score: coherencia de metadatos EXIF.';
COMMENT ON COLUMN reports.confidence_gps_score         IS 'Componente del score: precisión y coherencia del GPS.';
COMMENT ON COLUMN reports.confidence_fingerprint_score IS 'Componente del score: reputación/frecuencia del fingerprint de origen.';
COMMENT ON COLUMN reports.client_created_at            IS 'Momento real del avistamiento según el dispositivo. Se separa de synced_at para no distorsionar tendencias cuando un reporte estuvo offline (RNF12).';
COMMENT ON COLUMN reports.synced_at                    IS 'Momento en que el servidor recibió el reporte.';


-- Validación geográfica a nivel de BD: defensa en profundidad de RNF09.
-- Complementa (no reemplaza) la validación del cliente, que un atacante
-- podría saltarse llamando la API directamente.
CREATE OR REPLACE FUNCTION fn_validate_report_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM zones
    WHERE active = TRUE
      AND ST_Contains(boundary::geometry, NEW.location::geometry)
  ) THEN
    RAISE EXCEPTION 'Ubicación fuera de la zona geográfica permitida (RNF09)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_validate_report_location() IS 'Trigger BEFORE INSERT: rechaza reportes cuya ubicación cae fuera de cualquier zona activa (RNF09). Defensa en profundidad frente a un cliente que evada la validación local.';

CREATE TRIGGER trg_validate_report_location
  BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION fn_validate_report_location();


-- Validación de la estructura del campo details (formulario dinámico).
-- Cada tipo de incidente tiene un contrato de claves esperadas. Este trigger
-- rechaza reportes cuyo JSON no cumple el contrato del tipo correspondiente.
-- Mantiene la flexibilidad de JSONB pero evita que 'details' se convierta en
-- un basurero sin estructura. El contrato completo está en docs/DATA-MODEL.md.
CREATE OR REPLACE FUNCTION fn_validate_report_details()
RETURNS TRIGGER AS $$
DECLARE
  d JSONB := COALESCE(NEW.details, '{}'::jsonb);
BEGIN
  CASE NEW.incident_type

    -- Avistamiento simple: cantidad de perros obligatoria si es manada.
    WHEN 'avistamiento_simple' THEN
      IF NEW.sighting_type = 'manada'
         AND NOT (d ? 'cantidad_aprox' AND jsonb_typeof(d->'cantidad_aprox') = 'number') THEN
        RAISE EXCEPTION 'details.cantidad_aprox (number) es obligatorio para avistamiento en manada';
      END IF;

    -- Ataque a humano: debe indicar si hubo mordida/lesión (booleano).
    WHEN 'ataque_humano' THEN
      IF NOT (d ? 'hubo_mordida' AND jsonb_typeof(d->'hubo_mordida') = 'boolean') THEN
        RAISE EXCEPTION 'details.hubo_mordida (boolean) es obligatorio para ataque_humano';
      END IF;

    -- Ataque a mascota: tipo de animal afectado y si resultó herido.
    WHEN 'ataque_mascota' THEN
      IF NOT (d ? 'tipo_animal' AND jsonb_typeof(d->'tipo_animal') = 'string') THEN
        RAISE EXCEPTION 'details.tipo_animal (string) es obligatorio para ataque_mascota';
      END IF;

    -- Ataque a ganado: tipo de animal y cantidad aproximada afectada.
    WHEN 'ataque_ganado' THEN
      IF NOT (d ? 'tipo_animal' AND jsonb_typeof(d->'tipo_animal') = 'string') THEN
        RAISE EXCEPTION 'details.tipo_animal (string) es obligatorio para ataque_ganado';
      END IF;
      IF NOT (d ? 'cantidad_afectada' AND jsonb_typeof(d->'cantidad_afectada') = 'number') THEN
        RAISE EXCEPTION 'details.cantidad_afectada (number) es obligatorio para ataque_ganado';
      END IF;

    -- Perro lastimado: tipo de situación del animal.
    WHEN 'perro_lastimado' THEN
      IF NOT (d ? 'situacion' AND jsonb_typeof(d->'situacion') = 'string') THEN
        RAISE EXCEPTION 'details.situacion (string) es obligatorio para perro_lastimado';
      END IF;

    -- 'otro': sin claves obligatorias; se acepta descripción libre.
    ELSE
      NULL;

  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_validate_report_details() IS 'Trigger BEFORE INSERT: valida que reports.details cumpla el contrato de claves esperadas según incident_type (formulario dinámico, RF24/RNF36). Mantiene JSONB flexible pero estructurado. Contrato completo en docs/DATA-MODEL.md.';

CREATE TRIGGER trg_validate_report_details
  BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION fn_validate_report_details();


-- ----------------------------------------------------------------------------
-- 6. report_flags — denuncias de reportes (RF08)
--    Tabla separada porque un reporte puede recibir MUCHAS denuncias (1-a-N).
-- ----------------------------------------------------------------------------
CREATE TABLE report_flags (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id            UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  reason               flag_reason NOT NULL,
  reason_detail        TEXT,
  device_fingerprint   TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un mismo origen no puede denunciar el mismo reporte más de una vez.
  -- Cierra un hueco de abuso y apoya la ponderación por diversidad (RNF29).
  UNIQUE (report_id, device_fingerprint)
);

CREATE INDEX idx_flags_report ON report_flags (report_id);

COMMENT ON TABLE  report_flags                    IS 'Denuncias de usuarios sobre reportes que consideran inválidos (RF08). Relación 1-a-N con reports.';
COMMENT ON COLUMN report_flags.reason             IS 'Motivo: foto_falsa, contenido_inapropiado, burla, no_es_callejero (mascota con dueño), u otro (RF08).';
COMMENT ON COLUMN report_flags.device_fingerprint IS 'Fingerprint anónimo del denunciante. Usado para rate limiting y ponderación por diversidad (RNF29).';


-- Auto-ocultamiento al superar el umbral configurable (RF21/HU-21).
-- Corre inmediatamente tras cada denuncia para que el ocultamiento sea
-- instantáneo ("se oculta automáticamente"), sin esperar revisión del admin.
CREATE OR REPLACE FUNCTION fn_check_flag_threshold()
RETURNS TRIGGER AS $$
DECLARE
  v_threshold  INT;
  v_count      INT;
BEGIN
  SELECT value::INT INTO v_threshold FROM app_settings WHERE key = 'flag_auto_hide_threshold';
  SELECT COUNT(*) INTO v_count FROM report_flags WHERE report_id = NEW.report_id;

  IF v_count >= v_threshold THEN
    UPDATE reports
    SET status = 'oculto',
        hidden_reason = 'umbral_denuncias',
        hidden_at = now()
    WHERE id = NEW.report_id AND status = 'visible';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_check_flag_threshold() IS 'Trigger AFTER INSERT en report_flags: oculta el reporte automáticamente si sus denuncias alcanzan el umbral configurable (RF21). El reporte pasa a la cola de revisión del admin.';

CREATE TRIGGER trg_check_flag_threshold
  AFTER INSERT ON report_flags
  FOR EACH ROW EXECUTE FUNCTION fn_check_flag_threshold();


-- ----------------------------------------------------------------------------
-- 7. duplicate_candidates — cola de posibles duplicados (RF23, v2)
--    Relaciona dos reportes sospechosos de ser el MISMO avistamiento, según
--    heurística de cercanía en lugar + tiempo + atributos. NO usa comparación
--    visual (eso es fase 2 / RNF35). NUNCA fusiona ni oculta: solo agrupa para
--    que el ADMINISTRADOR decida manualmente.
-- ----------------------------------------------------------------------------
CREATE TABLE duplicate_candidates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_a        UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  report_b        UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  distance_meters NUMERIC(8,2),
  minutes_apart   NUMERIC(8,2),
  status          duplicate_status NOT NULL DEFAULT 'pendiente',
  reviewed_by     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Evita registrar dos veces el mismo par. Se normaliza en la capa de
  -- aplicación / trigger para que siempre report_a < report_b.
  UNIQUE (report_a, report_b),
  CHECK (report_a <> report_b)
);

CREATE INDEX idx_dup_status   ON duplicate_candidates (status);
CREATE INDEX idx_dup_report_a ON duplicate_candidates (report_a);
CREATE INDEX idx_dup_report_b ON duplicate_candidates (report_b);

COMMENT ON TABLE  duplicate_candidates                 IS 'Pares de reportes sospechosos de ser el mismo avistamiento (RF23). Detección HEURÍSTICA (lugar+tiempo+atributos), NO visual. Nunca fusiona ni oculta: alimenta la cola de revisión manual del admin (RNF30). La comparación visual real es fase 2 (RNF35).';
COMMENT ON COLUMN duplicate_candidates.report_a        IS 'Primer reporte del par candidato (normalizado: id menor).';
COMMENT ON COLUMN duplicate_candidates.report_b        IS 'Segundo reporte del par candidato (normalizado: id mayor).';
COMMENT ON COLUMN duplicate_candidates.distance_meters IS 'Distancia geográfica entre ambos reportes al momento de detectarse.';
COMMENT ON COLUMN duplicate_candidates.minutes_apart   IS 'Diferencia temporal en minutos entre client_created_at de ambos reportes.';
COMMENT ON COLUMN duplicate_candidates.status          IS 'Decisión del admin: pendiente / confirmado (sí es duplicado) / descartado (no lo es).';
COMMENT ON COLUMN duplicate_candidates.reviewed_by     IS 'Administrador que revisó el par (FK a profiles). NULL mientras esté pendiente.';


-- Detección de candidatos a duplicado tras insertar un reporte (RF23).
-- Usa solo consultas baratas (PostGIS + comparación de atributos), viables en
-- el VPS actual. Empareja el reporte nuevo con reportes visibles recientes y
-- cercanos que compartan tamaño y/o color. La decisión final es del admin.
CREATE OR REPLACE FUNCTION fn_detect_duplicates()
RETURNS TRIGGER AS $$
DECLARE
  v_radius   NUMERIC;
  v_window   NUMERIC;
BEGIN
  SELECT value::NUMERIC INTO v_radius FROM app_settings WHERE key = 'dup_radius_meters';
  SELECT value::NUMERIC INTO v_window FROM app_settings WHERE key = 'dup_time_window_minutes';

  INSERT INTO duplicate_candidates (report_a, report_b, distance_meters, minutes_apart)
  SELECT
    LEAST(r.id, NEW.id),
    GREATEST(r.id, NEW.id),
    ST_Distance(r.location, NEW.location),
    ABS(EXTRACT(EPOCH FROM (r.client_created_at - NEW.client_created_at)) / 60)
  FROM reports r
  WHERE r.id <> NEW.id
    AND r.status = 'visible'
    AND ST_DWithin(r.location, NEW.location, v_radius)
    AND ABS(EXTRACT(EPOCH FROM (r.client_created_at - NEW.client_created_at)) / 60) <= v_window
    -- Señal de atributos: mismo tamaño o mismo color (cuando existen en el nuevo).
    AND (
         (r.tamano IS NOT DISTINCT FROM NEW.tamano AND NEW.tamano IS NOT NULL)
      OR (lower(r.color_predominante) = lower(NEW.color_predominante) AND NEW.color_predominante IS NOT NULL)
    )
  ON CONFLICT (report_a, report_b) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION fn_detect_duplicates() IS 'Trigger AFTER INSERT en reports: registra pares candidatos a duplicado según cercanía en lugar/tiempo y coincidencia de atributos (RF23). Heurística barata (sin IA visual). Solo sugiere; el admin decide (RNF30).';

CREATE TRIGGER trg_detect_duplicates
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION fn_detect_duplicates();


-- ----------------------------------------------------------------------------
-- 8. audit_log — trazabilidad de acciones administrativas (RNF33)
--    Sin políticas de UPDATE/DELETE (ver sección RLS): un log editable deja de
--    ser evidencia confiable.
-- ----------------------------------------------------------------------------
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES profiles(id),
  report_id   UUID NOT NULL REFERENCES reports(id),
  action      audit_action NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_report ON audit_log (report_id);

COMMENT ON TABLE  audit_log        IS 'Registro inmutable de acciones administrativas sobre reportes (ocultar/eliminar/restaurar) para rendición de cuentas (RNF33). Sin UPDATE/DELETE por diseño.';
COMMENT ON COLUMN audit_log.action IS 'Acción realizada: ocultar / eliminar / restaurar.';


-- ----------------------------------------------------------------------------
-- 9. Row Level Security (RNF20)
--    RLS filtra FILAS. El filtrado de COLUMNAS para el público se hace con la
--    vista public_reports (sección 10).
-- ----------------------------------------------------------------------------
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones                ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_flags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

-- profiles: cada cuenta solo ve su propio perfil.
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (auth.uid() = id);

-- reports: cualquiera (anon) puede insertar (RF01) — sin login.
CREATE POLICY reports_insert_anon ON reports
  FOR INSERT TO anon
  WITH CHECK (true);

-- reports: anon solo lee reportes visibles (filtra FILAS).
CREATE POLICY reports_select_anon ON reports
  FOR SELECT TO anon
  USING (status = 'visible');

-- reports: staff (Asociación/Admin) lee todo, incluidos ocultos (RF16, RF19).
CREATE POLICY reports_select_staff ON reports
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('asociacion','administrador')
  ));

-- reports: solo el Administrador cambia el estado (ocultar/eliminar/restaurar, RF20).
CREATE POLICY reports_update_admin ON reports
  FOR UPDATE TO authenticated
  USING     (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrador'))
  WITH CHECK(EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrador'));

-- report_flags: cualquiera (anon) puede denunciar (RF08).
CREATE POLICY flags_insert_anon ON report_flags
  FOR INSERT TO anon
  WITH CHECK (true);

-- report_flags: solo staff ve el detalle de denuncias (RF19).
CREATE POLICY flags_select_staff ON report_flags
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('asociacion','administrador')
  ));

-- duplicate_candidates: solo el Administrador ve y resuelve la cola (RF23).
CREATE POLICY dup_select_admin ON duplicate_candidates
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrador'));

CREATE POLICY dup_update_admin ON duplicate_candidates
  FOR UPDATE TO authenticated
  USING     (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrador'))
  WITH CHECK(EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrador'));

-- audit_log: solo el Administrador escribe y lee (RNF33).
CREATE POLICY audit_insert_admin ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrador'));

CREATE POLICY audit_select_admin ON audit_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'administrador'));


-- ----------------------------------------------------------------------------
-- 10. public_reports — vista pública para el mapa anónimo (RF10, RNF13)
--     Las FILAS ya vienen filtradas por reports_select_anon; aquí se restringen
--     las COLUMNAS: nunca se exponen fingerprint, scores ni EXIF al público.
-- ----------------------------------------------------------------------------
CREATE VIEW public_reports AS
SELECT
  r.id,
  r.location,
  r.incident_type,
  r.sighting_type,
  r.details,
  r.color_predominante,
  r.tamano,
  r.tiene_collar,
  r.photo_url,
  r.client_created_at,
  -- RF21: los usuarios pueden ver SI un reporte tiene denuncias (warning),
  -- pero no el motivo ni quién denunció. Solo un booleano.
  EXISTS (SELECT 1 FROM report_flags f WHERE f.report_id = r.id) AS has_flags
FROM reports r;

COMMENT ON VIEW public_reports IS 'Proyección pública y segura de reports para el mapa anónimo (RF10). Omite columnas sensibles (fingerprint, scores, EXIF) — filtrado de COLUMNAS que RLS no hace. has_flags expone solo si hay denuncias, no su detalle (RF21).';

GRANT SELECT ON public_reports TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- 11. get_report_clusters — clustering en tiempo real para el mapa (RF11-RF14)
--     Se calcula al vuelo (no precalculado) por elección de diseño para el
--     prototipo. Viable gracias al índice GIST sobre reports.location.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_report_clusters(eps_meters DOUBLE PRECISION DEFAULT 500)
RETURNS TABLE (
  cluster_id             INT,
  report_count           BIGINT,
  centroid               GEOGRAPHY,
  dominant_incident_type incident_type
) AS $$
  WITH clustered AS (
    SELECT
      incident_type,
      location,
      ST_ClusterDBSCAN(location::geometry, eps := eps_meters, minpoints := 1) OVER () AS cluster_id
    FROM public_reports
  )
  SELECT
    cluster_id,
    COUNT(*)                                               AS report_count,
    ST_Centroid(ST_Collect(location::geometry))::geography AS centroid,
    -- Simplificado: tipo más frecuente. El orden de severidad real
    -- (ataque_humano > ataque_ganado > ...) se resuelve en la capa de
    -- aplicación combinando esto con el desglose por tipo (RF13).
    MODE() WITHIN GROUP (ORDER BY incident_type)           AS dominant_incident_type
  FROM clustered
  GROUP BY cluster_id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_report_clusters(DOUBLE PRECISION) IS 'Agrupa reportes públicos en clusters con ST_ClusterDBSCAN para el mapa (RF11-RF14). eps_meters se mapea al nivel de zoom en la app. Devuelve conteo, centroide y tipo dominante por cluster.';
