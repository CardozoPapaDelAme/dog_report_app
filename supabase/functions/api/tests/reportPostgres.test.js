import postgres from "postgres";

const permitted = Deno.permissions.querySync({
  name: "env",
  variable: "REPORT_TEST_DATABASE_URL",
}).state === "granted";
const databaseUrl = permitted
  ? Deno.env.get("REPORT_TEST_DATABASE_URL")
  : undefined;

const migrations = [
  "20260908232749_initial_target_schema.sql",
  "20260909023000_add_photo_public_window_reset.sql",
  "20260909163000_split_retention_phases.sql",
  "20260914183000_report_replay_lookup_rls.sql",
  "20260921010000_preserve_zone_set_retirement_evidence.sql",
  "20260921010500_store_immutable_zone_set_geojson.sql",
  "20260921011000_grant_zone_set_retirement_update.sql",
  "20260923090000_allow_anonymous_flag_origin_reads.sql",
  "20260924010000_allow_public_map_flag_reads.sql",
  "20261001034500_grant_rate_limit_bucket_select.sql",
  "20261001120000_split_backend_mutate_policies.sql",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uuid(n) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function hash(n) {
  return (n % 16).toString(16).repeat(64);
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

async function rejects(operation, code, message) {
  try {
    await operation();
  } catch (error) {
    assert(error.code === code, `Expected ${code}, got ${error.code}`);
    assert(
      error.message.includes(message),
      `Expected ${message}, got ${error.message}`,
    );
    return error;
  }
  throw new Error(`Expected rejection: ${message}`);
}

Deno.test({
  name: "RNF36 SQL: report details are validated by the real PostgreSQL trigger",
  ignore: !databaseUrl,
  async fn(t) {
    const url = new URL(databaseUrl);
    assert(
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
        url.pathname === "/fab5_report_test",
      "Only a disposable local fab5_report_test database is allowed.",
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

      let next = 1;
      async function insertReport({
        incidentType = "avistamiento_simple",
        sightingType = "solitario",
        details = {},
      }) {
        const index = next++;
        const id = uuid(index);
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
            client_created_at
          )
          VALUES (
            ${id},
            ${hash(index)},
            extensions.ST_SetSRID(
              extensions.ST_MakePoint(${-107.63 + index * 0.001}, ${27.73 + index * 0.001}),
              4326
            )::extensions.geography,
            10,
            FALSE,
            ${incidentType}::public.incident_type,
            ${sightingType}::public.sighting_type,
            ${sql.json(details)},
            now() - interval '1 hour'
          )
        `;
        return id;
      }

      await t.step(
        "accepts valid details for minima, maxima and representative averages",
        async () => {
          await insertReport({
            sightingType: "solitario",
            details: { cantidad_aprox: 1, descripcion: "Solitario valido" },
          });
          await insertReport({
            sightingType: "manada",
            details: { cantidad_aprox: 2, descripcion: "Manada minima" },
          });
          await insertReport({
            sightingType: "manada",
            details: { cantidad_aprox: 500, descripcion: "Manada promedio" },
          });
          await insertReport({
            sightingType: "manada",
            details: { cantidad_aprox: 1000, descripcion: "Manada maxima" },
          });
          await insertReport({
            incidentType: "ataque_humano",
            details: { hubo_mordida: true, descripcion: "Ataque humano" },
          });
          await insertReport({
            incidentType: "ataque_mascota",
            details: {
              tipo_animal: "gato",
              resulto_herido: false,
              descripcion: "Ataque mascota",
            },
          });
          await insertReport({
            incidentType: "ataque_ganado",
            details: {
              tipo_animal: "vaca",
              cantidad_afectada: 1,
              descripcion: "Ataque ganado",
            },
          });
          await insertReport({
            incidentType: "perro_lastimado",
            details: { situacion: "mal_estado", descripcion: "Perro lastimado" },
          });
          await insertReport({
            incidentType: "otro",
            details: { descripcion: "Otro incidente" },
          });

          const [{ count }] = await sql`
            SELECT count(*)::int AS count FROM public.reports
          `;
          assert(count === 9, "Every valid details case should persist.");
        },
      );

      await t.step("rejects invalid details with trigger messages", async () => {
        await rejects(
          () =>
            insertReport({
              sightingType: "manada",
              details: { cantidad_aprox: 1 },
            }),
          "22023",
          "invalid_pack_count",
        );
        await rejects(
          () =>
            insertReport({
              sightingType: "manada",
              details: { cantidad_aprox: 1001 },
            }),
          "22023",
          "invalid_sighting_count",
        );
        await rejects(
          () =>
            insertReport({
              incidentType: "ataque_humano",
              details: { descripcion: "Falta mordida" },
            }),
          "22023",
          "missing_hubo_mordida",
        );
        await rejects(
          () =>
            insertReport({
              incidentType: "perro_lastimado",
              details: { situacion: "paseando" },
            }),
          "22023",
          "invalid_injury_situation",
        );
        await rejects(
          () =>
            insertReport({
              details: { cantidad_aprox: 1, extra: true },
            }),
          "22023",
          "unexpected_details_key",
        );
        await rejects(
          () =>
            insertReport({
              details: { descripcion: "x".repeat(2001) },
            }),
          "22023",
          "invalid_description",
        );

        const [{ count }] = await sql`
          SELECT count(*)::int AS count FROM public.reports
        `;
        assert(
          count === 9,
          "Rejected details must not leave partial report rows.",
        );
      });
    } finally {
      await sql.end();
    }
  },
});
