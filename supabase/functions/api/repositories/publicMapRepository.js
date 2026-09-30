import { INCIDENT_TYPES } from "../domain/publicMap.js";

export async function listPublicReports(tx, { since, limit }) {
  const rows = await tx`
    WITH visible_reports AS (
      SELECT
        r.id,
        app_private.approximate_public_location(r.location) AS public_location,
        r.incident_type,
        r.sighting_type,
        r.details,
        r.color_predominante,
        r.tamano,
        r.tiene_collar,
        EXISTS (
          SELECT 1
          FROM public.photo_assets pa
          WHERE pa.report_id = r.id
            AND pa.state = 'approved'
        ) AS has_sanitized_photo,
        r.client_created_at,
        r.published_at,
        EXISTS (
          SELECT 1
          FROM public.report_flags f
          WHERE f.report_id = r.id
        ) AS has_flags
      FROM public.reports r
      WHERE r.status = 'visible'
        AND r.public_until > now()
        AND (
          ${since ?? null}::timestamptz IS NULL
          OR r.published_at >= ${since ?? null}::timestamptz
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.duplicate_memberships dm
          WHERE dm.report_id = r.id
            AND dm.active = TRUE
            AND dm.member_role = 'duplicate'
        )
      ORDER BY r.published_at DESC, r.id DESC
      LIMIT ${limit}
    )
    SELECT
      id AS report_id,
      extensions.ST_X(public_location::extensions.geometry) AS approximate_longitude,
      extensions.ST_Y(public_location::extensions.geometry) AS approximate_latitude,
      incident_type,
      sighting_type,
      details,
      color_predominante,
      tamano,
      tiene_collar,
      has_sanitized_photo,
      client_created_at AS occurred_at,
      has_flags
    FROM visible_reports
    ORDER BY published_at DESC, id DESC
  `;
  return rows;
}

export async function listPublicClusters(
  tx,
  { zoom, radiusMeters, viewport, limit },
) {
  const hasViewport = viewport !== null;
  const rows = await tx`
    WITH candidate_reports AS (
      SELECT
        r.id,
        r.incident_type,
        r.published_at,
        extensions.ST_Transform(r.location::extensions.geometry, 32613) AS metric_point
      FROM public.reports r
      WHERE r.status = 'visible'
        AND r.public_until > now()
        AND (
          ${hasViewport} = FALSE
          OR extensions.ST_Covers(
            extensions.ST_MakeEnvelope(
              ${viewport?.minLongitude ?? 0},
              ${viewport?.minLatitude ?? 0},
              ${viewport?.maxLongitude ?? 0},
              ${viewport?.maxLatitude ?? 0},
              4326
            ),
            r.location::extensions.geometry
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.duplicate_memberships dm
          WHERE dm.report_id = r.id
            AND dm.active = TRUE
            AND dm.member_role = 'duplicate'
        )
      ORDER BY r.published_at DESC, r.id DESC
      LIMIT ${limit}
    ),
    clustered AS (
      SELECT
        id,
        incident_type,
        published_at,
        metric_point,
        extensions.ST_ClusterDBSCAN(metric_point, ${radiusMeters}, 1)
          OVER (ORDER BY id) AS cluster_number
      FROM candidate_reports
    ),
    aggregated AS (
      SELECT
        cluster_number,
        array_agg(id::text ORDER BY id::text) AS member_ids,
        count(*)::int AS report_count,
        max(published_at) AS latest_published_at,
        app_private.approximate_public_location(
          extensions.ST_Transform(
            extensions.ST_Centroid(extensions.ST_Collect(metric_point)),
            4326
          )::extensions.geography
        ) AS public_location,
        count(*) FILTER (
          WHERE incident_type = ${INCIDENT_TYPES[0]}::public.incident_type
        )::int AS count_avistamiento_simple,
        count(*) FILTER (
          WHERE incident_type = ${INCIDENT_TYPES[1]}::public.incident_type
        )::int AS count_ataque_mascota,
        count(*) FILTER (
          WHERE incident_type = ${INCIDENT_TYPES[2]}::public.incident_type
        )::int AS count_ataque_ganado,
        count(*) FILTER (
          WHERE incident_type = ${INCIDENT_TYPES[3]}::public.incident_type
        )::int AS count_ataque_humano,
        count(*) FILTER (
          WHERE incident_type = ${INCIDENT_TYPES[4]}::public.incident_type
        )::int AS count_perro_lastimado,
        count(*) FILTER (
          WHERE incident_type = ${INCIDENT_TYPES[5]}::public.incident_type
        )::int AS count_otro
      FROM clustered
      GROUP BY cluster_number
    )
    SELECT
      concat(
        'z',
        ${zoom},
        '-r',
        ${radiusMeters},
        '-',
        md5(array_to_string(member_ids, ','))
      ) AS cluster_id,
      report_count,
      extensions.ST_X(public_location::extensions.geometry) AS approximate_longitude,
      extensions.ST_Y(public_location::extensions.geometry) AS approximate_latitude,
      count_avistamiento_simple,
      count_ataque_mascota,
      count_ataque_ganado,
      count_ataque_humano,
      count_perro_lastimado,
      count_otro
    FROM aggregated
    ORDER BY latest_published_at DESC, cluster_id
  `;
  return rows;
}
