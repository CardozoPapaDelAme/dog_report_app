import postgres from "postgres";
import { Hono } from "hono";
import { createDuplicateService } from "../services/duplicateService.js";
import * as repository from "../repositories/duplicateRepository.js";
import { createDuplicateRoutes } from "../routes/duplicateGroups.js";
import { requestId } from "../middleware/requestId.js";
import { actor, assert, rejects, uuid } from "./helpers/duplicateFixture.js";

// Dedicated disposable database only. Never use Wildogscanner/shared Supabase.
const permitted = Deno.permissions.querySync({
  name: "env",
  variable: "DUPLICATE_TEST_DATABASE_URL",
}).state === "granted";
const databaseUrl = permitted
  ? Deno.env.get("DUPLICATE_TEST_DATABASE_URL")
  : undefined;
const migrations = [
  "20260908232749_initial_target_schema.sql",
  "20260909023000_add_photo_public_window_reset.sql",
  "20260909163000_split_retention_phases.sql",
  "20260921010000_preserve_zone_set_retirement_evidence.sql",
  "20260921010500_store_immutable_zone_set_geojson.sql",
  "20260921011000_grant_zone_set_retirement_update.sql",
];
Deno.test({
  name:
    "FAB-3 SQL: real HTTP resolution, graph, reversal, rollback, concurrency and RLS",
  ignore: !databaseUrl,
  async fn(t) {
    const url = new URL(databaseUrl);
    assert(
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
        url.pathname === "/fab3_duplicate_test",
      "Only a disposable local fab3_duplicate_test database is allowed",
    );
    const sql = postgres(databaseUrl, {
      max: 10,
      prepare: false,
      onnotice: () => {},
    });
    try {
      const tables =
        await sql`SELECT table_schema,table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema') AND table_schema NOT LIKE 'pg_%'`;
      assert(tables.length === 0, "Refusing a nonempty database");
      assert(
        (await sql`SELECT 1 FROM pg_extension WHERE extname = 'postgis'`)
          .length === 0,
        "Create a new database without preinstalled PostGIS",
      );
      await sql.unsafe(
        `CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);`,
      );
      for (const name of migrations) {
        const source = await Deno.readTextFile(
          new URL(`../../../migrations/${name}`, import.meta.url),
        );
        await sql.begin((tx) =>
          tx.unsafe(
            source.replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, ""),
          )
        );
      }
      await sql`INSERT INTO auth.users(id) VALUES (${actor.userId}),(${
        uuid(101)
      })`;
      await sql`INSERT INTO public.profiles(id,role,active) VALUES (${actor.userId},'administrator',TRUE),(${
        uuid(101)
      },'association',TRUE)`;
      const backend = {
        begin: (operation) =>
          sql.begin(async (tx) => {
            await tx`SET LOCAL ROLE app_backend`;
            return operation(tx);
          }),
      };
      const makeService = (repo = repository) =>
        createDuplicateService({
          getSql: () => backend,
          getConfig: () => ({ expectedEnvironment: "staging" }),
          repository: repo,
        });
      const service = makeService();
      const app = new Hono().basePath("/api");
      app.use("*", requestId);
      app.route(
        "/",
        createDuplicateRoutes({
          service,
          authorize: async (c, next) => {
            c.set("auth", actor);
            await next();
          },
        }),
      );
      const request = (path, body, method = "POST") =>
        app.request(`/api/admin/duplicateGroups${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      const asRole = (role, operation) =>
        backend.begin(async (tx) => {
          await tx`SELECT set_config('app.user_id',${
            role === "association" ? uuid(101) : actor.userId
          },true)`;
          await tx`SELECT set_config('app.role',${role},true)`;
          return operation(tx);
        });
      let batch = 0;
      async function seedChain(count = 3) {
        batch++;
        const ids = [];
        for (let i = 0; i < count; i++) {
          const id = uuid(1000 + batch * 10 + i);
          ids.push(id);
          const longitude = -107.63 + batch * 0.01 + i * 0.001;
          await sql`INSERT INTO public.reports(id,submission_hash,location,gps_accuracy_meters,mock_location_suspected,incident_type,sighting_type,details,color_predominante,tamano,status,status_reason,client_created_at,accepted_at,published_at,public_until)
            VALUES (${id},${
            "a".repeat(64)
          },extensions.ST_SetSRID(extensions.ST_MakePoint(${longitude},27.73),4326)::extensions.geography,10,FALSE,'avistamiento_simple','solitario',${
            sql.json({ cantidad_aprox: 1, descripcion: "Original evidence" })
          },'cafe','mediano','visible','administrator_approved',now(),now(),now(),now()+interval '90 days')`;
          await sql`INSERT INTO public.photo_assets(report_id,source_sha256) VALUES (${id},${
            "b".repeat(64)
          })`;
        }
        return ids;
      }
      const resolution = (ids) => ({
        canonical_report_id: ids[0],
        report_ids: ids,
        note: "Local human review",
      });
      const evidence = async () =>
        JSON.stringify({
          reports: await sql`SELECT * FROM public.reports ORDER BY id`,
          photos: await sql`SELECT * FROM public.photo_assets ORDER BY id`,
        });
      const state = async () =>
        JSON.stringify({
          groups: await sql`SELECT * FROM public.duplicate_groups ORDER BY id`,
          members:
            await sql`SELECT * FROM public.duplicate_memberships ORDER BY id`,
          candidates:
            await sql`SELECT * FROM public.duplicate_candidates ORDER BY id`,
          audits: await sql`SELECT * FROM public.audit_log ORDER BY id`,
        });
      let firstIds, firstGroup;
      await t.step(
        "real detection supplies a chain; HTTP resolves it without changing reports or photos",
        async () => {
          firstIds = await seedChain();
          const candidates =
            await sql`SELECT * FROM public.duplicate_candidates WHERE report_a IN ${
              sql(firstIds)
            } AND report_b IN ${sql(firstIds)}`;
          assert(
            candidates.length === 2,
            "Detection must suggest A–B–C without requiring A–C",
          );
          const original = await evidence();
          const { note: _note, ...withoutNote } = resolution(firstIds);
          const response = await request("", withoutNote);
          const body = await response.json();
          assert(response.status === 201, JSON.stringify(body));
          firstGroup = body.data.duplicate_group;
          assert(
            firstGroup.report_ids.length === 3 &&
              firstGroup.resolution_version === 1,
          );
          assert(
            await evidence() === original,
            "Report rows and photo evidence must be byte-for-byte unchanged",
          );
          const audits =
            await sql`SELECT * FROM public.audit_log WHERE entity_id=${firstGroup.id}`;
          assert(
            audits.length === 1 && audits[0].actor_id === actor.userId &&
              audits[0].action === "duplicate_resolved" &&
              typeof audits[0].new_values === "object",
          );
          const listed = await (await request("", undefined, "GET")).json();
          assert(
            listed.data.duplicate_groups.some((g) => g.id === firstGroup.id),
          );
        },
      );
      await t.step(
        "noncanonical members disappear from anonymous and Association projections",
        async () => {
          for (const role of ["anonymous", "association"]) {
            const rows = await asRole(
              role,
              (tx) =>
                tx`SELECT id FROM public.reports WHERE id IN ${tx(firstIds)}`,
            );
            assert(
              rows.length === 1 && rows[0].id === firstIds[0],
              `${role} must see only the canonical report`,
            );
          }
        },
      );
      await t.step(
        "reversal reopens review, preserves moderation and history, permits a new resolution",
        async () => {
          const original = await evidence();
          const response = await request(`/${firstGroup.id}/reverse`, {
            note: "Reopen candidate review",
          });
          const body = await response.json();
          assert(
            response.status === 200 &&
              body.data.duplicate_group.resolution_version === 2,
            JSON.stringify(body),
          );
          assert(await evidence() === original);
          assert(
            (await sql`SELECT * FROM public.duplicate_memberships WHERE group_id=${firstGroup.id} AND active`)
              .length === 0,
          );
          const candidates =
            await sql`SELECT status,reviewed_by,reviewed_at FROM public.duplicate_candidates WHERE report_a IN ${
              sql(firstIds)
            } AND report_b IN ${sql(firstIds)}`;
          assert(
            candidates.every((c) =>
              c.status === "pending" && c.reviewed_by === null &&
              c.reviewed_at === null
            ),
          );
          assert(
            (await asRole(
              "anonymous",
              (tx) =>
                tx`SELECT id FROM public.reports WHERE id IN ${tx(firstIds)}`,
            ))
              .length === 3,
          );
          const before = await state();
          await rejects(
            () =>
              service.reverse({
                actor,
                groupId: firstGroup.id,
                input: { note: "Again" },
              }),
            "duplicate_group_conflict",
          );
          assert(
            await state() === before,
            "Stale reversal must not append another audit",
          );
          const next = await service.resolve({
            actor,
            input: resolution(firstIds),
          });
          assert(next.id !== firstGroup.id && next.resolution_version === 1);
          await service.reverse({
            actor,
            groupId: next.id,
            input: { note: "Review later" },
          });
        },
      );
      await t.step(
        "disconnected, missing, deleted, overlapping and nonpending candidates fail atomically",
        async () => {
          const ids = await seedChain();
          const before = await state();
          await rejects(
            () =>
              service.resolve({ actor, input: resolution([ids[0], ids[2]]) }),
            "duplicate_graph_disconnected",
          );
          await rejects(
            () =>
              service.resolve({
                actor,
                input: resolution([ids[0], uuid(99999)]),
              }),
            "not_found",
          );
          assert(await state() === before);
          await sql`UPDATE public.duplicate_candidates SET status='dismissed' WHERE report_a=${
            ids[1]
          } AND report_b=${ids[2]}`;
          await rejects(
            () => service.resolve({ actor, input: resolution(ids) }),
            "duplicate_graph_disconnected",
          );
          await sql`UPDATE public.duplicate_candidates SET status='pending' WHERE report_a=${
            ids[1]
          } AND report_b=${ids[2]}`;
          await sql`UPDATE public.reports SET status='deleted',deleted_at=now() WHERE id=${
            ids[2]
          }`;
          await rejects(
            () => service.resolve({ actor, input: resolution(ids) }),
            "duplicate_group_conflict",
          );
          await sql`UPDATE public.reports SET status='visible',deleted_at=NULL WHERE id=${
            ids[2]
          }`;
          await service.resolve({ actor, input: resolution(ids.slice(0, 2)) });
          const after = await state();
          await rejects(
            () => service.resolve({ actor, input: resolution(ids.slice(1)) }),
            "duplicate_membership_conflict",
          );
          assert(await state() === after);
        },
      );
      await t.step(
        "failures after audit insertion roll back resolution and reversal completely",
        async () => {
          const ids = await seedChain();
          const broken = makeService({
            ...repository,
            insertDuplicateAudit: async (...args) => {
              await repository.insertDuplicateAudit(...args);
              throw new Error("Injected after audit");
            },
          });
          let before = await state();
          await rejects(() =>
            broken.resolve({ actor, input: resolution(ids) })
          );
          assert(await state() === before);
          const group = await service.resolve({
            actor,
            input: resolution(ids),
          });
          before = await state();
          await rejects(() =>
            broken.reverse({
              actor,
              groupId: group.id,
              input: { note: "Review" },
            })
          );
          assert(await state() === before);
        },
      );
      await t.step(
        "overlapping concurrent resolutions have one winner and no partial group",
        async () => {
          const ids = await seedChain();
          const results = await Promise.allSettled([
            service.resolve({ actor, input: resolution(ids.slice(0, 2)) }),
            service.resolve({ actor, input: resolution(ids.slice(1)) }),
          ]);
          assert(results.filter((r) => r.status === "fulfilled").length === 1);
          const failed = results.find((r) => r.status === "rejected");
          assert(failed.reason.code === "duplicate_membership_conflict");
          const duplicates =
            await sql`SELECT report_id FROM public.duplicate_memberships WHERE active GROUP BY report_id HAVING count(*)>1`;
          assert(duplicates.length === 0);
          const winner = results.find((r) => r.status === "fulfilled").value;
          const reversals = await Promise.allSettled([
            service.reverse({
              actor,
              groupId: winner.id,
              input: { note: "First" },
            }),
            service.reverse({
              actor,
              groupId: winner.id,
              input: { note: "Second" },
            }),
          ]);
          assert(
            reversals.filter((r) => r.status === "fulfilled").length === 1,
          );
          assert(
            (await sql`SELECT id FROM public.audit_log WHERE entity_id=${winner.id} AND action='duplicate_reversed'`)
              .length === 1,
          );
        },
      );
      await t.step(
        "concurrent reverse and resolve serialize without changing original evidence",
        async () => {
          const ids = await seedChain();
          const group = await service.resolve({
            actor,
            input: resolution(ids),
          });
          const original = await evidence();
          const results = await Promise.allSettled([
            service.reverse({
              actor,
              groupId: group.id,
              input: { note: "recheck" },
            }),
            service.resolve({ actor, input: resolution(ids) }),
          ]);
          assert(results[0].status === "fulfilled");
          if (results[1].status === "rejected") {
            assert(results[1].reason.code === "duplicate_membership_conflict");
          }
          assert(await evidence() === original);
        },
      );
      await t.step(
        "RLS and grants deny other roles, original-field edits and audit rewrites",
        async () => {
          for (const role of ["anonymous", "association"]) {
            assert(
              (await asRole(
                role,
                (tx) => tx`SELECT id FROM public.duplicate_groups`,
              )).length === 0,
            );
            await rejects(
              () =>
                asRole(
                  role,
                  (tx) =>
                    tx`INSERT INTO public.duplicate_groups(canonical_report_id,resolved_by) VALUES (${
                      firstIds[0]
                    },${actor.userId})`,
                ),
              "42501",
            );
          }
          assert(
            (await backend.begin((tx) =>
              tx`SELECT id FROM public.duplicate_groups`
            )).length === 0,
            "Pooled local actor context must not leak",
          );
          await rejects(
            () =>
              asRole(
                "administrator",
                (tx) =>
                  tx`UPDATE public.reports SET details='{}'::jsonb WHERE id=${
                    firstIds[0]
                  }`,
              ),
            "42501",
          );
          await rejects(
            () =>
              asRole(
                "administrator",
                (tx) =>
                  tx`DELETE FROM public.duplicate_groups WHERE id=${firstGroup.id}`,
              ),
            "42501",
          );
          await rejects(
            () =>
              asRole(
                "administrator",
                (tx) =>
                  tx`UPDATE public.audit_log SET note='rewrite' WHERE entity_id=${firstGroup.id}`,
              ),
            "42501",
          );
          await rejects(
            () =>
              asRole(
                "administrator",
                (tx) =>
                  tx`UPDATE public.duplicate_groups SET canonical_report_id=${
                    firstIds[1]
                  } WHERE id=${firstGroup.id}`,
              ),
            "42501",
          );
        },
      );
      await t.step(
        "reversal preserves subsequent moderation and tolerates a retained group with a purged member",
        async () => {
          const ids = await seedChain(4);
          const group = await service.resolve({
            actor,
            input: resolution(ids.slice(0, 3)),
          });
          await sql`UPDATE public.reports SET status = 'deleted', deleted_at = now() WHERE id = ${
            ids[1]
          }`;
          await sql`UPDATE public.reports SET status = 'hidden', hidden_at = now() WHERE id = ${
            ids[2]
          }`;
          const original = await evidence();
          await service.reverse({
            actor,
            groupId: group.id,
            input: { note: "Preserve later moderation" },
          });
          assert(
            await evidence() === original,
            "Reversal must not restore deleted reports or publish hidden ones",
          );
          const [external] =
            await sql`SELECT status, reviewed_at FROM public.duplicate_candidates WHERE report_a = ${
              ids[2]
            } AND report_b = ${ids[3]}`;
          assert(
            external.status === "pending" && external.reviewed_at === null,
            "External candidate review remains untouched",
          );
          const retained = await seedChain(2);
          const retainedGroup = await service.resolve({
            actor,
            input: resolution(retained),
          });
          // Owner-only fixture operation simulates retention; the backend cannot delete.
          await sql`DELETE FROM public.reports WHERE id = ${retained[1]}`;
          const reversed = await service.reverse({
            actor,
            groupId: retainedGroup.id,
            input: { note: "Release surviving membership" },
          });
          assert(
            reversed.status === "reversed" && reversed.report_ids.length === 1,
          );
        },
      );
      await t.step(
        "disabled profiles and mismatched environment cannot read or resolve",
        async () => {
          await sql`UPDATE public.profiles SET active=FALSE WHERE id=${actor.userId}`;
          await rejects(() => service.list({ actor }), "forbidden");
          await sql`UPDATE public.profiles SET active=TRUE WHERE id=${actor.userId}`;
          const mismatch = createDuplicateService({
            getSql: () => backend,
            getConfig: () => ({ expectedEnvironment: "production" }),
            repository,
          });
          await rejects(() => mismatch.list({ actor }), "preflight_mismatch");
        },
      );
    } finally {
      await sql.end();
    }
  },
});
