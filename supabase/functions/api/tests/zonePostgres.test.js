import postgres from "postgres";
import { canonicalZoneGeometry, sha256Hex } from "../domain/zoneSet.js";
import * as repository from "../repositories/zoneRepository.js";
import { createZoneService } from "../services/zoneService.js";

// Opt-in only: a fresh, disposable Postgres database with no preinstalled
// PostGIS extension. Never point this suite at Supabase or a shared database.
const canReadUrl = Deno.permissions.querySync({
  name: "env",
  variable: "ZONE_TEST_DATABASE_URL",
}).state === "granted";
const databaseUrl = canReadUrl
  ? Deno.env.get("ZONE_TEST_DATABASE_URL")
  : undefined;

const userId = "00000000-0000-4000-8000-000000000101";
const actor = {
  type: "authenticated",
  userId,
  role: "administrator",
  profile: { id: userId, role: "administrator", active: true },
};
const firstGeometry = {
  type: "Polygon",
  coordinates: [[
    [-107.64, 27.73],
    [-107.63, 27.73],
    [-107.63, 27.74],
    [-107.64, 27.73],
  ]],
};
const secondGeometry = {
  type: "MultiPolygon",
  coordinates: [[[
    [-107.62, 27.73],
    [-107.61, 27.73],
    [-107.61, 27.74],
    [-107.62, 27.73],
  ]]],
};
const selfIntersectingGeometry = {
  type: "Polygon",
  coordinates: [[
    [-107.64, 27.73],
    [-107.63, 27.74],
    [-107.63, 27.73],
    [-107.64, 27.74],
    [-107.64, 27.73],
  ]],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function rejects(operation, code) {
  try {
    await operation();
  } catch (error) {
    if (code) {
      assert(error.code === code, `Expected ${code}, got ${error.code}`);
    }
    return error;
  }
  throw new Error("Expected operation to fail.");
}

async function input(name, geometry) {
  return {
    name,
    source_uri: `https://example.test/${name}.geojson`,
    source_version: name,
    source_sha256: await sha256Hex(canonicalZoneGeometry(geometry)),
    geometry,
  };
}

async function migrationSource(name) {
  return Deno.readTextFile(
    new URL(`../../../../supabase/migrations/${name}`, import.meta.url),
  );
}

function withoutOuterTransaction(source) {
  // Supabase applies each migration atomically. The postgres driver correctly
  // rejects a hand-written BEGIN on a pooled connection, so remove only a file's
  // top-level wrapper while keeping all DDL and nested PL/pgSQL blocks intact.
  return source
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "");
}

const baseMigrations = [
  "20260908232749_initial_target_schema.sql",
  "20260909023000_add_photo_public_window_reset.sql",
  "20260909163000_split_retention_phases.sql",
];
const l2Migrations = [
  "20260921010000_preserve_zone_set_retirement_evidence.sql",
  "20260921010500_store_immutable_zone_set_geojson.sql",
  "20260921011000_grant_zone_set_retirement_update.sql",
];

async function installPrerequisites(sql) {
  await sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
      END IF;
    END;
    $$;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY);
  `);
}

async function applyMigrations(sql, names) {
  for (const name of names) {
    await sql.unsafe(withoutOuterTransaction(await migrationSource(name)));
  }
}

Deno.test({
  name:
    "FAB-2 SQL: PostGIS zone creation, replacement, rollback and concurrency",
  ignore: !databaseUrl,
  async fn(t) {
    const url = new URL(databaseUrl);
    assert(
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
        url.pathname === "/fab2_zone_test",
      "Use a fresh local fab2_zone_test database only.",
    );
    const sql = postgres(databaseUrl, {
      max: 10,
      prepare: false,
      onnotice: () => {},
    });
    try {
      const [postgis] = await sql`
        SELECT namespace.nspname AS schema_name
        FROM pg_extension extension
        JOIN pg_namespace namespace ON namespace.oid = extension.extnamespace
        WHERE extension.extname = 'postgis'
      `;
      assert(
        !postgis,
        "Create a new database after starting the PostGIS container; it must not preinstall PostGIS in public.",
      );
      const tables = await sql`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_schema NOT LIKE 'pg_%'
      `;
      assert(tables.length === 0, "Refusing to alter a nonempty database.");
      await installPrerequisites(sql);
      await applyMigrations(sql, baseMigrations);

      await sql`INSERT INTO auth.users (id) VALUES (${userId})`;
      await sql`
        INSERT INTO public.profiles (id, role, active)
        VALUES (${userId}, 'administrator', TRUE)
      `;
      await t.step(
        "stops safely when legacy lifecycle evidence is incomplete",
        async () => {
          const [legacy] = await sql`
          INSERT INTO public.zone_sets (
            environment, version, name, source_uri, source_version, source_sha256,
            status, association_approval_reference, activated_at, created_by
          ) VALUES (
            'staging', 1, 'Legacy active zone', 'https://example.test/legacy.geojson',
            'legacy', ${
            "a".repeat(64)
          }, 'active', 'AHC-LEGACY', now(), ${userId}
          ) RETURNING id
        `;
          const error = await rejects(
            () =>
              sql.begin(async (tx) => {
                await tx.unsafe(
                  await migrationSource(
                    "20260921010000_preserve_zone_set_retirement_evidence.sql",
                  ),
                );
              }),
            "23514",
          );
          assert(
            error.message.includes("compatible historical evidence"),
            "The lifecycle preflight must explain how legacy evidence blocks the migration.",
          );
          await sql`DELETE FROM public.zone_sets WHERE id = ${legacy.id}`;
        },
      );
      await applyMigrations(sql, l2Migrations);

      const backend = {
        begin: (operation) =>
          sql.begin(async (tx) => {
            await tx`SET LOCAL ROLE app_backend`;
            return operation(tx);
          }),
      };
      const withActorRole = (role, operation) =>
        backend.begin(async (tx) => {
          await tx`SELECT set_config('app.user_id', ${userId}, true)`;
          await tx`SELECT set_config('app.role', ${role}, true)`;
          return operation(tx);
        });
      const withAdministrator = (operation) =>
        withActorRole("administrator", operation);
      const makeService = (repo = repository) =>
        createZoneService({
          getSql: () => backend,
          getConfig: () => ({ expectedEnvironment: "staging" }),
          repository: repo,
        });
      const service = makeService();
      const snapshot = async () =>
        JSON.stringify({
          zoneSets: await sql`
            SELECT id, environment, version, name, source_sha256, source_geojson,
              status, association_approval_reference, approved_at, activated_at, retired_at
            FROM public.zone_sets ORDER BY version
          `,
          zones: await sql`
            SELECT zone_set_id, name, extensions.ST_AsGeoJSON(boundary::extensions.geometry) AS geometry
            FROM public.zones ORDER BY zone_set_id
          `,
          audits: await sql`
            SELECT action, entity_id, previous_values, new_values, note
            FROM public.audit_log ORDER BY created_at, id
          `,
        });

      await t.step(
        "grants app_backend only the retirement column needed by atomic replacement",
        async () => {
          const [privilege] = await sql`
          SELECT
            has_column_privilege(
              'app_backend', 'public.zone_sets', 'retired_at', 'UPDATE'
            ) AS can_retire,
            has_column_privilege(
              'app_backend', 'public.zone_sets', 'source_uri', 'UPDATE'
            ) AS can_rewrite_source
        `;
          assert(
            privilege.can_retire && !privilege.can_rewrite_source,
            "app_backend must update retired_at but not immutable source metadata.",
          );
        },
      );

      await t.step(
        "creates an immutable draft with a valid PostGIS MultiPolygon and audit",
        async () => {
          const created = await service.create({
            actor,
            input: await input("creel-v1", firstGeometry),
          });
          assert(
            created.status === "draft",
            "Creation must not activate the zone set.",
          );
          const [stored] = await sql`
          SELECT source_geojson->>'type' AS source_type,
            extensions.ST_GeometryType(boundary::extensions.geometry) AS boundary_type,
            extensions.ST_IsValid(boundary::extensions.geometry) AS valid,
            extensions.ST_IsEmpty(boundary::extensions.geometry) AS empty
          FROM public.zone_sets zone_set
          JOIN public.zones zone ON zone.zone_set_id = zone_set.id
          WHERE zone_set.id = ${created.id}
        `;
          assert(
            stored.source_type === "MultiPolygon" &&
              stored.boundary_type === "ST_MultiPolygon" &&
              stored.valid && !stored.empty,
            "Source and PostGIS boundary must be a nonempty valid MultiPolygon.",
          );
          const [audit] = await sql`
          SELECT action, actor_id FROM public.audit_log WHERE entity_id = ${created.id}
        `;
          assert(
            audit.action === "zone_set_created" && audit.actor_id === userId,
            "Creation audit must be attributed to the Administrator.",
          );
        },
      );

      await t.step(
        "rejects an empty boundary through the real PostGIS table constraint",
        async () => {
          const candidate = await service.create({
            actor,
            input: await input("empty-boundary-candidate", firstGeometry),
          });
          const before = await snapshot();
          await rejects(
            () =>
              withAdministrator((tx) =>
                tx`
                INSERT INTO public.zones (zone_set_id, name, boundary)
                VALUES (
                  ${candidate.id}, 'Empty boundary',
                  extensions.ST_SetSRID(
                    extensions.ST_GeomFromGeoJSON(
                      ${'{"type":"MultiPolygon","coordinates":[]}'}
                    ),
                    4326
                  )::extensions.geography
                )
              `
              ),
            "23514",
          );
          assert(
            await snapshot() === before,
            "An empty boundary must not persist a zone or audit mutation.",
          );
        },
      );

      let first;
      let second;
      await t.step(
        "replaces an active zone with preserved retirement evidence and one active row",
        async () => {
          first =
            (await sql`SELECT id FROM public.zone_sets WHERE version = 1`)[0];
          await service.activate({
            actor,
            zoneSetId: first.id,
            input: {
              association_approval_reference: "AHC-LOCAL-1",
              note: "Initial local approval.",
            },
          });
          second = await service.create({
            actor,
            input: await input("creel-v2", secondGeometry),
          });
          await service.activate({
            actor,
            zoneSetId: second.id,
            input: {
              association_approval_reference: "AHC-LOCAL-2",
              note: "Replacement local approval.",
            },
          });
          const [retired] = await sql`
          SELECT status, activated_at, retired_at FROM public.zone_sets WHERE id = ${first.id}
        `;
          const [activeCount] = await sql`
          SELECT count(*)::int AS count
          FROM public.zone_sets WHERE environment = 'staging' AND status = 'active'
        `;
          assert(
            retired.status === "retired" && retired.activated_at &&
              retired.retired_at &&
              retired.retired_at >= retired.activated_at &&
              activeCount.count === 1,
            "Replacement must preserve lifecycle evidence and leave one active zone.",
          );
        },
      );

      await t.step(
        "rejects a self-intersecting geometry through real PostGIS without mutation",
        async () => {
          const before = await snapshot();
          await rejects(
            async () =>
              service.create({
                actor,
                input: await input("invalid-bow-tie", selfIntersectingGeometry),
              }),
            "invalid_request",
          );
          assert(
            await snapshot() === before,
            "Invalid geometry must not persist a zone set, zone, or audit.",
          );
        },
      );

      await t.step(
        "rolls back retirement, activation and audit together when audit persistence fails",
        async () => {
          const candidate = await service.create({
            actor,
            input: await input("creel-v3", firstGeometry),
          });
          const before = await snapshot();
          const failing = makeService({
            ...repository,
            insertZoneAudit: async (...args) => {
              await repository.insertZoneAudit(...args);
              throw new Error("Injected audit failure.");
            },
          });
          await rejects(
            () =>
              failing.activate({
                actor,
                zoneSetId: candidate.id,
                input: { association_approval_reference: "AHC-LOCAL-3" },
              }),
          );
          assert(
            await snapshot() === before,
            "Failed activation must leave the previous active set intact.",
          );
        },
      );

      await t.step(
        "serializes concurrent replacements and keeps exactly one active zone",
        async () => {
          const [fourth, fifth] = await Promise.all([
            service.create({
              actor,
              input: await input("creel-v4", firstGeometry),
            }),
            service.create({
              actor,
              input: await input("creel-v5", secondGeometry),
            }),
          ]);
          const results = await Promise.all([
            service.activate({
              actor,
              zoneSetId: fourth.id,
              input: { association_approval_reference: "AHC-LOCAL-4" },
            }),
            service.activate({
              actor,
              zoneSetId: fifth.id,
              input: { association_approval_reference: "AHC-LOCAL-5" },
            }),
          ]);
          const [activeCount] = await sql`
          SELECT count(*)::int AS count
          FROM public.zone_sets WHERE environment = 'staging' AND status = 'active'
        `;
          assert(
            results.every((result) => result.status === "active") &&
              activeCount.count === 1,
            "Concurrent replacements must serialize and leave one active zone.",
          );
        },
      );

      await t.step(
        "enforces RLS and narrow grants outside the audited lifecycle transition",
        async () => {
          const associationRows = await withActorRole("association", (tx) =>
            tx`
            UPDATE public.zone_sets SET status = status
            WHERE id = ${second.id}
            RETURNING id
          `);
          assert(
            associationRows.length === 0,
            "Association context must not mutate Administrator zone sets.",
          );
          await rejects(
            () =>
              withAdministrator(
                (tx) =>
                  tx`
                UPDATE public.zone_sets SET source_uri = 'https://attacker.test/rewrite'
                WHERE id = ${second.id}
              `,
              ),
            "42501",
          );
          await rejects(
            () =>
              withAdministrator(
                (tx) =>
                  tx`
                UPDATE public.audit_log SET note = 'rewritten'
                WHERE entity_id = ${second.id}
              `,
              ),
            "42501",
          );
          await rejects(
            () =>
              withAdministrator(
                (tx) =>
                  tx`
                DELETE FROM public.zones WHERE zone_set_id = ${second.id}
              `,
              ),
            "42501",
          );
        },
      );
    } finally {
      await sql.end();
    }
  },
});
