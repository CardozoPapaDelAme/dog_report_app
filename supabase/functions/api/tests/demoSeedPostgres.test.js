import postgres from "postgres";

import { listAcceptedAssociationReports } from "../repositories/associationReportRepository.js";
import { readPhotoStatusForOrigin } from "../repositories/photoRepository.js";
import { listPublicReports } from "../repositories/publicMapRepository.js";

const permitted = Deno.permissions.querySync({
  name: "env",
  variable: "DEMO_SEED_TEST_DATABASE_URL",
}).state === "granted";
const databaseUrl = permitted
  ? Deno.env.get("DEMO_SEED_TEST_DATABASE_URL")
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

const MARKER = "de300000-0000-4000-8000-%";
const DEMO_FINGERPRINT = "demo-creel-photo-uploader-2026";
const PHOTO_REPORTS = [1, 6, 10, 16, 17, 19, 21, 25];
const EXPECTED_TYPES = {
  "avistamiento_simple/solitario": 13,
  "avistamiento_simple/manada": 13,
  perro_lastimado: 9,
  ataque_mascota: 9,
  ataque_ganado: 7,
  ataque_humano: 5,
  otro: 4,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function demoId(n) {
  return `de300000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function withoutOuterTransaction(source) {
  return source
    .replace(/^\s*BEGIN;\s*$/im, "")
    .replace(/^\s*COMMIT;\s*$/im, "");
}

async function readSource(relativeUrl) {
  return withoutOuterTransaction(
    await Deno.readTextFile(new URL(relativeUrl, import.meta.url)),
  );
}

Deno.test({
  name: "Demo seed SQL: removable Creel demo reports for map, dashboard and queue",
  ignore: !databaseUrl,
  async fn(t) {
    const url = new URL(databaseUrl);
    assert(
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
        url.pathname === "/fab_demo_seed_test",
      "Only a disposable local fab_demo_seed_test database is allowed.",
    );
    const sql = postgres(databaseUrl, {
      max: 4,
      prepare: false,
      onnotice: () => {},
    });

    try {
      const tables = await sql`
        SELECT 1 FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_schema NOT LIKE 'pg_%'
      `;
      assert(tables.length === 0, "Refusing a nonempty database.");

      await sql.unsafe(
        `CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);`,
      );
      for (const name of migrations) {
        const source = await readSource(`../../../migrations/${name}`);
        await sql.begin((tx) => tx.unsafe(source));
      }

      const seed = await readSource("../../../../scripts/demo-seed.sql");
      const unseed = await readSource("../../../../scripts/demo-unseed.sql");
      const runSeed = () => sql.begin((tx) => tx.unsafe(seed));
      const runUnseed = () => sql.begin((tx) => tx.unsafe(unseed));

      const associationId = "00000000-0000-4000-8000-000000009001";
      await sql`INSERT INTO auth.users(id) VALUES (${associationId})`;
      await sql`
        INSERT INTO public.profiles(id, role, active)
        VALUES (${associationId}, 'association', TRUE)
      `;

      // One non-demo report that must survive both scripts untouched.
      const otherId = "00000000-0000-4000-8000-000000000777";
      await sql`
        INSERT INTO public.reports (
          id, submission_hash, location, gps_accuracy_meters, mock_location_suspected,
          incident_type, sighting_type, details, status, status_reason,
          client_created_at, accepted_at, published_at, public_until
        ) VALUES (
          ${otherId}, ${"e".repeat(64)},
          extensions.ST_SetSRID(extensions.ST_MakePoint(-107.6355, 27.7522), 4326)::extensions.geography,
          10, FALSE, 'avistamiento_simple', 'solitario',
          ${sql.json({ cantidad_aprox: 1, descripcion: "Non-demo report" })},
          'visible', 'administrator_approved',
          now() - interval '45 days', now() - interval '45 days',
          now() - interval '45 days', now() + interval '45 days'
        )
      `;

      const demoCount = async () =>
        Number(
          (await sql`SELECT count(*) AS n FROM public.reports WHERE id::text LIKE ${MARKER}`)[0].n,
        );

      await t.step("seed creates 60 marker reports with the agreed mix", async () => {
        await runSeed();
        assert(await demoCount() === 60, "Expected 60 demo reports.");

        const statuses = Object.fromEntries(
          (await sql`
            SELECT status::text, count(*)::int AS n FROM public.reports
            WHERE id::text LIKE ${MARKER} GROUP BY status
          `).map((row) => [row.status, row.n]),
        );
        assert(statuses.visible === 52, `visible: ${statuses.visible}`);
        assert(statuses.pending_review === 8, `pending: ${statuses.pending_review}`);

        const types = Object.fromEntries(
          (await sql`
            SELECT
              CASE WHEN incident_type = 'avistamiento_simple'
                THEN 'avistamiento_simple/' || sighting_type ELSE incident_type::text END AS key,
              count(*)::int AS n
            FROM public.reports WHERE id::text LIKE ${MARKER} GROUP BY 1
          `).map((row) => [row.key, row.n]),
        );
        assert(
          JSON.stringify(types, Object.keys(EXPECTED_TYPES).sort()) ===
            JSON.stringify(EXPECTED_TYPES, Object.keys(EXPECTED_TYPES).sort()),
          `type mix: ${JSON.stringify(types)}`,
        );
      });

      await t.step("dates, positions and trust values are consistent", async () => {
        const [bad] = await sql`
          SELECT
            count(*) FILTER (WHERE status = 'visible' AND NOT (
              accepted_at > now() - interval '30 days' AND accepted_at <= now()
              AND published_at = accepted_at AND public_until > now()
              AND public_until = published_at + interval '90 days'
              AND trust_tier IN ('high', 'medium')
            ))::int AS bad_visible,
            count(*) FILTER (WHERE status = 'pending_review' AND NOT (
              accepted_at IS NULL AND public_until IS NULL
              AND synced_at > now() - interval '4 days'
              AND status_reason = 'medium_or_low_trust'
            ))::int AS bad_pending,
            count(*) FILTER (WHERE NOT (
              client_created_at < synced_at AND synced_at <= now()
              AND synced_at - client_created_at < interval '1 hour'
              AND gps_accuracy_meters BETWEEN 5 AND 25
              AND NOT mock_location_suspected
              AND details->>'descripcion' <> ''
              AND extensions.ST_DWithin(
                location,
                extensions.ST_SetSRID(extensions.ST_MakePoint(-107.6355, 27.7522), 4326)::extensions.geography,
                6500
              )
            ))::int AS bad_any,
            count(DISTINCT submission_hash)::int AS hashes,
            count(DISTINCT (accepted_at AT TIME ZONE 'America/Chihuahua')::date)
              FILTER (WHERE status = 'visible')::int AS visible_days
          FROM public.reports WHERE id::text LIKE ${MARKER}
        `;
        assert(bad.bad_visible === 0, `bad visible rows: ${bad.bad_visible}`);
        assert(bad.bad_pending === 0, `bad pending rows: ${bad.bad_pending}`);
        assert(bad.bad_any === 0, `bad rows: ${bad.bad_any}`);
        assert(bad.hashes === 60, "submission_hash must be unique.");
        assert(bad.visible_days >= 24, `visible days: ${bad.visible_days}`);
      });

      await t.step("demo reports never become duplicate candidates", async () => {
        const [row] = await sql`
          SELECT count(*)::int AS n FROM public.duplicate_candidates
          WHERE report_a::text LIKE ${MARKER} OR report_b::text LIKE ${MARKER}
        `;
        assert(row.n === 0, `duplicate candidates: ${row.n}`);
      });

      await t.step("visible demo reports reach the public map and the association dashboard", async () => {
        const publicRows = await sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE app_backend`;
          await tx`SELECT set_config('app.role', 'anonymous', true)`;
          return listPublicReports(tx, { since: null, limit: 500 });
        });
        const publicDemo = publicRows.filter((row) => row.report_id.startsWith("de300000-"));
        assert(publicDemo.length === 52, `public map demo rows: ${publicDemo.length}`);

        const associationRows = await sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE app_backend`;
          await tx`SELECT set_config('app.role', 'association', true)`;
          await tx`SELECT set_config('app.user_id', ${associationId}, true)`;
          return listAcceptedAssociationReports(tx, {
            from: new Date(Date.now() - 30 * 86_400_000).toISOString(),
            to: null,
            limit: 500,
            cursor: null,
          });
        });
        const associationDemo = associationRows.filter((row) => row.id.startsWith("de300000-"));
        assert(associationDemo.length === 52, `dashboard demo rows: ${associationDemo.length}`);
      });

      await t.step("the documented demo fingerprint authorizes exactly the photo reports", async () => {
        const originHash = await sha256Hex(DEMO_FINGERPRINT);
        for (const n of PHOTO_REPORTS) {
          const row = await sql.begin(async (tx) => {
            await tx`SET LOCAL ROLE app_backend`;
            await tx`SELECT set_config('app.role', 'anonymous', true)`;
            await tx`SELECT set_config('app.origin_hash', ${originHash}, true)`;
            await tx`SELECT set_config('app.report_id', ${demoId(n)}, true)`;
            return readPhotoStatusForOrigin(tx, { reportId: demoId(n), originHash });
          });
          assert(row?.photo_expected === true, `report ${n} must expect a photo`);
          assert(row.state === null, `report ${n} starts without a photo`);
        }
        const [row] = await sql`
          SELECT
            count(*) FILTER (WHERE photo_expected)::int AS expected,
            count(*) FILTER (WHERE photo_expected AND status = 'visible'
              AND device_fingerprint_hash = ${originHash}
              AND fingerprint_expires_at > now() + interval '14 days')::int AS usable
          FROM public.reports WHERE id::text LIKE ${MARKER}
        `;
        assert(row.expected === 8 && row.usable === 8, JSON.stringify(row));
      });

      await t.step("rerunning the seed is idempotent and resets demo moderation", async () => {
        await sql`
          UPDATE public.reports SET status = 'hidden', status_reason = 'administrator_hidden',
            hidden_at = now()
          WHERE id = ${demoId(2)}
        `;
        await sql`INSERT INTO public.report_flags(report_id, reason) VALUES (${demoId(3)}, 'otro')`;
        await sql`
          INSERT INTO public.photo_assets (
            report_id, state, source_sha256, approved_object_path, detected_mime_type,
            byte_size, width_pixels, height_pixels, sanitized_sha256, approved_at, purge_after
          ) VALUES (
            ${demoId(1)}, 'approved', ${"b".repeat(64)}, ${`reports/${demoId(1)}/x.jpg`},
            'image/jpeg', 1000, 640, 480, ${"c".repeat(64)}, now(), now()
          )
        `;

        await runSeed();
        assert(await demoCount() === 60, "Rerun must keep 60 demo reports.");
        const [row] = await sql`
          SELECT
            (SELECT status::text FROM public.reports WHERE id = ${demoId(2)}) AS status2,
            (SELECT count(*)::int FROM public.report_flags WHERE report_id::text LIKE ${MARKER}) AS flags,
            (SELECT count(*)::int FROM public.reports WHERE id::text LIKE ${MARKER} AND status = 'visible') AS visible,
            (SELECT pa.purge_after = r.public_until FROM public.photo_assets pa
              JOIN public.reports r ON r.id = pa.report_id WHERE pa.report_id = ${demoId(1)}) AS aligned
        `;
        assert(row.status2 === "visible", "Rerun restores moderation state.");
        assert(row.flags === 0, "Rerun clears demo flags.");
        assert(row.visible === 52, "Rerun keeps 52 visible.");
        assert(row.aligned === true, "Rerun keeps the uploaded photo aligned.");
      });

      await t.step("unseed removes demo rows, waiting only for stored photo objects", async () => {
        await runUnseed();
        const [first] = await sql`
          SELECT
            (SELECT count(*)::int FROM public.reports WHERE id::text LIKE ${MARKER}) AS reports,
            (SELECT status::text FROM public.reports WHERE id = ${demoId(1)}) AS status1,
            (SELECT state::text FROM public.photo_assets WHERE report_id = ${demoId(1)}) AS photo1
        `;
        assert(first.reports === 1, `Only the report with a stored photo waits: ${first.reports}`);
        assert(first.status1 === "deleted" && first.photo1 === "purge_pending", JSON.stringify(first));

        // What the retention job does after deleting the Storage object.
        const [photo] = await sql`SELECT id FROM public.photo_assets WHERE report_id = ${demoId(1)}`;
        await sql.begin(async (tx) => {
          await tx`SELECT set_config('app.role', 'internal', true)`;
          await tx`SELECT app_private.acknowledge_photo_purge(${photo.id})`;
        });

        await runUnseed();
        assert(await demoCount() === 0, "Second unseed removes the rest.");
        const [left] = await sql`
          SELECT
            (SELECT count(*)::int FROM public.photo_assets WHERE report_id::text LIKE ${MARKER}) AS photos,
            (SELECT count(*)::int FROM public.report_flags WHERE report_id::text LIKE ${MARKER}) AS flags,
            (SELECT count(*)::int FROM public.duplicate_candidates
              WHERE report_a::text LIKE ${MARKER} OR report_b::text LIKE ${MARKER}) AS candidates,
            (SELECT count(*)::int FROM public.reports WHERE id = ${otherId} AND status = 'visible') AS other
        `;
        assert(left.photos === 0 && left.flags === 0 && left.candidates === 0, JSON.stringify(left));
        assert(left.other === 1, "Non-demo report must survive.");

        await runUnseed();
        assert(await demoCount() === 0, "Unseed is safe to rerun.");
      });
    } finally {
      await sql.end();
    }
  },
});
