import postgres from "postgres";
import * as repository from "../repositories/flag-repository.js";
import { submitFlag } from "../services/flag-service.js";
import { sha256Hex } from "../services/reportService.js";

const permitted = Deno.permissions.querySync({
  name: "env",
  variable: "FLAG_TEST_DATABASE_URL",
}).state === "granted";
const databaseUrl = permitted
  ? Deno.env.get("FLAG_TEST_DATABASE_URL")
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

async function rejects(operation, code) {
  try {
    await operation();
  } catch (error) {
    if (code) {
      assert(error.code === code, `Expected ${code}, got ${error.code}`);
    }
    return error;
  }
  throw new Error(`Expected rejection: ${code}`);
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

function uuid(n) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

Deno.test({
  name: "L2 SQL: flag RLS, uniqueness, auto-hide and rollback",
  ignore: !databaseUrl,
  async fn(t) {
    const url = new URL(databaseUrl);
    assert(
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
        url.pathname === "/fab4_flag_test",
      "Only a disposable local fab4_flag_test database is allowed.",
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
        "Create a new database without preinstalled PostGIS.",
      );
      await sql.unsafe(
        `CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);`,
      );
      for (const name of migrations) {
        const source = withoutOuterTransaction(await migrationSource(name));
        await sql.begin((tx) => tx.unsafe(source));
      }

      const backend = {
        begin: (operation) =>
          sql.begin(async (tx) => {
            await tx`SET LOCAL ROLE app_backend`;
            return operation(tx);
          }),
      };
      const service = (reportId, deviceFingerprint, repo = repository) =>
        submitFlag(
          {
            reportId,
            command: { reason: "otro", detail: "SQL test" },
            deviceFingerprint,
          },
          { getSql: () => backend, ...repo },
        );
      const withAnonymous = (requestedReportId, operation) =>
        backend.begin(async (tx) => {
          await tx`SELECT set_config('app.user_id', '', true)`;
          await tx`SELECT set_config('app.role', 'anonymous', true)`;
          await tx`SELECT set_config('app.origin_hash', ${
            "c".repeat(64)
          }, true)`;
          await tx`SELECT set_config('app.report_id', ${requestedReportId}, true)`;
          return operation(tx);
        });
      async function seedReport(id) {
        await sql`
          INSERT INTO public.reports (
            id, submission_hash, location, gps_accuracy_meters,
            mock_location_suspected, incident_type, sighting_type, details,
            status, status_reason, client_created_at, accepted_at, published_at,
            public_until
          )
          VALUES (
            ${id}, ${"a".repeat(64)},
            extensions.ST_SetSRID(extensions.ST_MakePoint(-107.63, 27.73), 4326)::extensions.geography,
            10, FALSE, 'avistamiento_simple', 'solitario',
            ${sql.json({ cantidad_aprox: 1, descripcion: "SQL flag test" })},
            'visible', 'administrator_approved', now(), now(), now(),
            now() + interval '90 days'
          )
        `;
      }

      const firstReport = uuid(1);
      const secondReport = uuid(2);
      const rollbackReport = uuid(3);
      await seedReport(firstReport);
      await seedReport(secondReport);
      await seedReport(rollbackReport);

      await t.step(
        "anonymous RLS reads flags for visible public canonical reports",
        async () => {
          await service(firstReport, "sql-device-fingerprint-0001");
          const visible = await withAnonymous(
            firstReport,
            (tx) =>
              tx`SELECT id FROM public.report_flags WHERE report_id = ${firstReport}`,
          );
          const visibleFromOtherPublicContext = await withAnonymous(
            secondReport,
            (tx) =>
              tx`SELECT id FROM public.report_flags WHERE report_id = ${firstReport}`,
          );

          assert(
            visible.length === 1,
            "Requested public canonical report flags should be readable.",
          );
          assert(
            visibleFromOtherPublicContext.length === 1,
            "Public map projections need batched flag-existence reads.",
          );
        },
      );

      await t.step(
        "database uniqueness rejects a repeated effective origin",
        async () => {
          const originHash = await sha256Hex("sql-device-fingerprint-0001");
          await rejects(
            () =>
              withAnonymous(
                firstReport,
                (tx) =>
                  tx`
                  INSERT INTO public.report_flags (
                    report_id, reason, device_fingerprint_hash, fingerprint_expires_at
                  )
                  VALUES (${firstReport}, 'otro', ${originHash}, now() + interval '30 days')
                `,
              ),
            "23505",
          );
        },
      );

      await t.step(
        "auto-hide and audit roll back together after audit failure",
        async () => {
          for (let i = 0; i < 4; i++) {
            await service(
              rollbackReport,
              `sql-rollback-device-${i}`.padEnd(24, "x"),
            );
          }
          const before = JSON.stringify({
            report:
              await sql`SELECT status, status_reason, hidden_at FROM public.reports WHERE id = ${rollbackReport}`,
            flags:
              await sql`SELECT id FROM public.report_flags WHERE report_id = ${rollbackReport} ORDER BY id`,
            audits:
              await sql`SELECT id FROM public.audit_log WHERE entity_id = ${rollbackReport}`,
          });
          const failing = {
            ...repository,
            insertFlagAudit: async (...args) => {
              await repository.insertFlagAudit(...args);
              throw new Error("Injected audit failure.");
            },
          };
          await rejects(() =>
            service(
              rollbackReport,
              "sql-rollback-device-4".padEnd(24, "x"),
              failing,
            )
          );
          assert(
            JSON.stringify({
              report:
                await sql`SELECT status, status_reason, hidden_at FROM public.reports WHERE id = ${rollbackReport}`,
              flags:
                await sql`SELECT id FROM public.report_flags WHERE report_id = ${rollbackReport} ORDER BY id`,
              audits:
                await sql`SELECT id FROM public.audit_log WHERE entity_id = ${rollbackReport}`,
            }) === before,
            "Failed audit should roll back the fifth flag and hidden state.",
          );

          const receipt = await service(
            rollbackReport,
            "sql-rollback-device-5".padEnd(24, "x"),
          );
          const [report] = await sql`
          SELECT status, status_reason FROM public.reports WHERE id = ${rollbackReport}
        `;
          const audits = await sql`
          SELECT action FROM public.audit_log WHERE entity_id = ${rollbackReport}
        `;
          assert(
            receipt.reportStatus === "hidden",
            "Threshold should hide the report.",
          );
          assert(
            report.status === "hidden" &&
              report.status_reason === "flag_threshold",
          );
          assert(
            audits.length === 1 && audits[0].action === "report_auto_hidden",
            "Successful auto-hide should have one audit row.",
          );
        },
      );
    } finally {
      await sql.end();
    }
  },
});
