import postgres from "postgres";
import { Hono } from "hono";

import { requestId } from "../middleware/requestId.js";
import { createPublicMapRoutes } from "../routes/publicMap.js";
import { createPublicMapService } from "../services/publicMapService.js";

const permitted = Deno.permissions.querySync({
  name: "env",
  variable: "PUBLIC_MAP_TEST_DATABASE_URL",
}).state === "granted";
const databaseUrl = permitted
  ? Deno.env.get("PUBLIC_MAP_TEST_DATABASE_URL")
  : undefined;

const migrations = [
  "20260908232749_initial_target_schema.sql",
  "20260909023000_add_photo_public_window_reset.sql",
  "20260909163000_split_retention_phases.sql",
  "20260921010000_preserve_zone_set_retirement_evidence.sql",
  "20260921010500_store_immutable_zone_set_geojson.sql",
  "20260921011000_grant_zone_set_retirement_update.sql",
  "20260923090000_allow_anonymous_flag_origin_reads.sql",
  "20260924010000_allow_public_map_flag_reads.sql",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uuid(n) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

async function migrationSource(name) {
  return Deno.readTextFile(
    new URL(`../../../migrations/${name}`, import.meta.url),
  );
}

function withoutOuterTransaction(source) {
  return source
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "");
}

function reportDetails(type, index) {
  if (type === "ataque_humano") {
    return { hubo_mordida: true, descripcion: `Public map attack ${index}` };
  }
  return { cantidad_aprox: 1, descripcion: `Public map sighting ${index}` };
}

Deno.test({
  name:
    "Public map SQL: stable approximate pins, canonical filtering and metric clusters",
  ignore: !databaseUrl,
  async fn(t) {
    const url = new URL(databaseUrl);
    assert(
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
        url.pathname === "/fab_public_map_test",
      "Only a disposable local fab_public_map_test database is allowed.",
    );
    const sql = postgres(databaseUrl, {
      max: 10,
      prepare: false,
      onnotice: () => {},
    });

    try {
      const tables = await sql`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_schema NOT LIKE 'pg_%'
      `;
      assert(tables.length === 0, "Refusing a nonempty database.");
      assert(
        (await sql`SELECT 1 FROM pg_extension WHERE extname = 'postgis'`)
          .length === 0,
        "Create a fresh database without preinstalled PostGIS.",
      );

      await sql.unsafe(
        `CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);`,
      );
      for (const name of migrations) {
        const source = withoutOuterTransaction(await migrationSource(name));
        await sql.begin((tx) => tx.unsafe(source));
      }

      const adminId = uuid(9000);
      await sql`INSERT INTO auth.users(id) VALUES (${adminId})`;
      await sql`
        INSERT INTO public.profiles(id, role, active)
        VALUES (${adminId}, 'administrator', TRUE)
      `;

      async function seedReport({
        id,
        longitude,
        latitude,
        incidentType = "avistamiento_simple",
        status = "visible",
        publicUntil = "90 days",
      }) {
        await sql`
          INSERT INTO public.reports (
            id,
            submission_hash,
            location,
            gps_accuracy_meters,
            mock_location_suspected,
            incident_type,
            sighting_type,
            details,
            status,
            status_reason,
            client_created_at,
            accepted_at,
            published_at,
            public_until
          )
          VALUES (
            ${id},
            ${"a".repeat(64)},
            extensions.ST_SetSRID(
              extensions.ST_MakePoint(${longitude}, ${latitude}),
              4326
            )::extensions.geography,
            10,
            FALSE,
            ${incidentType}::public.incident_type,
            'solitario',
            ${sql.json(reportDetails(incidentType, id))},
            ${status}::public.report_status,
            'administrator_approved',
            now() - interval '1 day',
            now() - interval '1 hour',
            now() - interval '30 minutes',
            CASE
              WHEN ${publicUntil} = 'expired' THEN now() - interval '1 minute'
              ELSE now() + (${publicUntil}::text)::interval
            END
          )
        `;
      }

      const first = uuid(1);
      const second = uuid(2);
      const severe = uuid(3);
      const hidden = uuid(4);
      const expired = uuid(5);
      const duplicate = uuid(6);

      await seedReport({ id: first, longitude: -107.63013, latitude: 27.73017 });
      await seedReport({ id: second, longitude: -107.63023, latitude: 27.73025 });
      await seedReport({
        id: severe,
        longitude: -107.63031,
        latitude: 27.73029,
        incidentType: "ataque_humano",
      });
      await seedReport({
        id: hidden,
        longitude: -107.63033,
        latitude: 27.73033,
        status: "hidden",
      });
      await seedReport({
        id: expired,
        longitude: -107.63035,
        latitude: 27.73035,
        publicUntil: "expired",
      });
      await seedReport({
        id: duplicate,
        longitude: -107.63037,
        latitude: 27.73037,
        incidentType: "ataque_ganado",
      });

      await sql`
        INSERT INTO public.photo_assets (
          report_id,
          state,
          source_sha256,
          approved_object_path,
          detected_mime_type,
          byte_size,
          width_pixels,
          height_pixels,
          sanitized_sha256,
          approved_at,
          purge_after
        )
        VALUES (
          ${first},
          'approved',
          ${"b".repeat(64)},
          'private/sanitized.jpg',
          'image/jpeg',
          1000,
          640,
          480,
          ${"c".repeat(64)},
          now(),
          now() + interval '90 days'
        )
      `;
      await sql`
        INSERT INTO public.report_flags(report_id, reason)
        VALUES (${first}, 'otro')
      `;

      const [group] = await sql`
        INSERT INTO public.duplicate_groups(canonical_report_id, resolved_by)
        VALUES (${first}, ${adminId})
        RETURNING id
      `;
      await sql`
        INSERT INTO public.duplicate_memberships(group_id, report_id, member_role)
        VALUES
          (${group.id}, ${first}, 'canonical'),
          (${group.id}, ${duplicate}, 'duplicate')
      `;

      const backend = {
        begin: (operation) =>
          sql.begin(async (tx) => {
            await tx`SET LOCAL ROLE app_backend`;
            return operation(tx);
          }),
      };
      const service = createPublicMapService({ getSql: () => backend });
      const app = new Hono().basePath("/api");
      app.use("*", requestId);
      app.route("/", createPublicMapRoutes({ service }));

      await t.step("public reports use stable approximate coordinates only", async () => {
        const firstResponse = await app.request("/api/public/reports?limit=20");
        const secondResponse = await app.request("/api/public/reports?limit=20");
        const firstBody = await firstResponse.json();
        const secondBody = await secondResponse.json();

        assert(firstResponse.status === 200, JSON.stringify(firstBody));
        assert(
          JSON.stringify(firstBody) === JSON.stringify(secondBody),
          "Repeated reads must return the same public approximation.",
        );
        assert(firstBody.data.length === 3, "Only visible canonical reports count.");
        assert(
          firstBody.data.every((item) => item.approximate_location && !item.location),
          "Public payload must expose only approximate_location.",
        );

        const firstItem = firstBody.data.find((item) => item.report_id === first);
        assert(firstItem.has_sanitized_photo === true, "Photo availability is public.");
        assert(firstItem.has_flags === true, "Public map must expose flag warning state.");
        assert(!Object.hasOwn(firstItem, "flags"), "Public map must not expose flag rows.");
        assert(
          Math.abs(firstItem.approximate_location.longitude - -107.63013) >
              0.0000001 ||
            Math.abs(firstItem.approximate_location.latitude - 27.73017) >
              0.0000001,
          "Approximate public location must not be the exact coordinate.",
        );
      });

      await t.step("public clusters group by zoom radius and return all six type counts", async () => {
        const response = await app.request(
          "/api/public/clusters?zoom=12&min_longitude=-107.64&min_latitude=27.72&max_longitude=-107.62&max_latitude=27.74&limit=20",
        );
        const body = await response.json();

        assert(response.status === 200, JSON.stringify(body));
        assert(body.data.length === 1, "Nearby visible canonical reports should cluster.");
        const [cluster] = body.data;
        assert(cluster.report_count === 3, "Hidden, expired and duplicate reports are excluded.");
        assert(cluster.highest_severity === "ataque_humano", "Highest severity wins.");
        assert(cluster.type_counts.avistamiento_simple === 2);
        assert(cluster.type_counts.ataque_humano === 1);
        for (
          const type of [
            "avistamiento_simple",
            "ataque_mascota",
            "ataque_ganado",
            "ataque_humano",
            "perro_lastimado",
            "otro",
          ]
        ) {
          assert(
            Object.hasOwn(cluster.type_counts, type),
            `type_counts must include ${type}.`,
          );
        }
      });
    } finally {
      await sql.end();
    }
  },
});
