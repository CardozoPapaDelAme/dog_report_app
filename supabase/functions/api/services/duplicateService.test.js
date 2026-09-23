import {
  actor,
  assert,
  duplicateFixture,
  input,
  rejects,
  uuid,
} from "../tests/helpers/duplicateFixture.js";
Deno.test("FAB-3 SERVICE: authorization and shape validation run before storage", async () => {
  const f = duplicateFixture();
  await rejects(
    () => f.service.list({ actor: { type: "anonymous" } }),
    "authentication_required",
  );
  await rejects(
    () =>
      f.service.resolve({ actor: { ...actor, role: "association" }, input }),
    "forbidden",
  );
  await rejects(
    () => f.service.resolve({ actor, input: { ...input, report_ids: [] } }),
    "invalid_request",
  );
  await rejects(
    () => f.service.reverse({ actor, groupId: "bad", input: { note: "why" } }),
    "invalid_request",
  );
  assert(f.events.length === 0, "Denied commands must not obtain a connection");
});
Deno.test("FAB-3 SERVICE: context, profile and environment fail closed", async () => {
  for (
    const [repository, code] of [[
      { readDuplicateActor: () => null },
      "forbidden",
    ], [
      { readDuplicateActor: () => ({ ...actor.profile, active: false }) },
      "forbidden",
    ], [{ readDuplicateEnvironment: () => "production" }, "preflight_mismatch"]]
  ) {
    const f = duplicateFixture({ repository });
    await rejects(() => f.service.resolve({ actor, input }), code);
    assert(f.events.at(-1) === "rollback" && !f.events.includes("lock"));
    assert(
      f.events[1][0].includes("app.user_id") &&
        f.events[2][0].includes("app.role"),
      "Actor context precedes repository access",
    );
  }
});
Deno.test("FAB-3 SERVICE: resolution and reversal preserve reports and reopen only internal candidates", async () => {
  const f = duplicateFixture();
  f.state().candidates.push({
    id: uuid(13),
    report_a: uuid(1),
    report_b: uuid(4),
    status: "pending",
  }, {
    id: uuid(14),
    report_a: uuid(1),
    report_b: uuid(3),
    status: "dismissed",
  });
  const originalReports = JSON.stringify(f.state().reports);
  const group = await f.service.resolve({ actor, input });
  assert(group.status === "active" && group.resolution_version === 1);
  assert((await f.service.list({ actor })).length === 1);
  await rejects(
    () => f.service.resolve({ actor, input }),
    "duplicate_membership_conflict",
  );
  const reversed = await f.service.reverse({
    actor,
    groupId: group.id,
    input: { note: "Review again" },
  });
  assert(reversed.status === "reversed" && reversed.resolution_version === 2);
  assert((await f.service.list({ actor })).length === 0);
  assert(f.state().memberships.every((m) => !m.active));
  assert(
    f.state().candidates[0].status === "pending" &&
      f.state().candidates[3].status === "dismissed",
  );
  assert(
    JSON.stringify(f.state().reports) === originalReports,
    "Moderation and original content stay intact",
  );
  assert(
    f.state().audits.length === 2 &&
      f.state().audits[1].note === "Review again",
  );
  await rejects(
    () =>
      f.service.reverse({ actor, groupId: group.id, input: { note: "Again" } }),
    "duplicate_group_conflict",
  );
  assert(
    (await f.service.resolve({ actor, input })).id !== group.id,
    "Re-resolution creates new history",
  );
});
Deno.test("FAB-3 SERVICE: disconnected graphs and unknown groups have no side effects", async () => {
  const f = duplicateFixture();
  f.state().candidates.pop();
  await rejects(
    () => f.service.resolve({ actor, input }),
    "duplicate_graph_disconnected",
  );
  await rejects(
    () =>
      f.service.reverse({
        actor,
        groupId: uuid(999),
        input: { note: "review" },
      }),
    "not_found",
  );
  assert(!f.state().groups.length && !f.state().audits.length);
});
Deno.test("FAB-3 SERVICE: audit failure rolls back each command", async () => {
  let fail = false;
  const f = duplicateFixture({
    repository: {
      insertDuplicateAudit: () => {
        if (fail) throw new Error("injected audit failure");
      },
    },
  });
  fail = true;
  const before = JSON.stringify(f.state());
  await rejects(() => f.service.resolve({ actor, input }));
  assert(JSON.stringify(f.state()) === before);
  fail = false;
  const group = await f.service.resolve({ actor, input });
  const resolved = JSON.stringify(f.state());
  fail = true;
  await rejects(() =>
    f.service.reverse({ actor, groupId: group.id, input: { note: "review" } })
  );
  assert(JSON.stringify(f.state()) === resolved);
});
Deno.test("FAB-3 SERVICE: known storage failures are mapped and unknown errors stay private", async () => {
  for (
    const [sqlCode, code] of [
      ["23505", "duplicate_group_conflict"],
      ["40P01", "duplicate_group_conflict"],
      ["23503", "duplicate_group_conflict"],
      ["42501", "forbidden"],
      ["08006", "dependency_unavailable"],
    ]
  ) {
    const f = duplicateFixture({
      repository: {
        readDuplicateActor: () => {
          throw Object.assign(new Error("SQL private"), { code: sqlCode });
        },
      },
    });
    await rejects(() => f.service.list({ actor }), code);
  }
});
