import { Hono } from "hono";
import { app as actualApp } from "../app.js";
import { requestId } from "../middleware/requestId.js";
import { createDuplicateRoutes } from "../routes/duplicateGroups.js";
import {
  actor,
  assert,
  duplicateFixture,
  input,
  uuid,
} from "../tests/helpers/duplicateFixture.js";
function harness(options = {}) {
  const f = duplicateFixture(options);
  const app = new Hono().basePath("/api");
  app.use("*", requestId);
  app.route(
    "/",
    createDuplicateRoutes({
      service: f.service,
      authorize: async (c, next) => {
        c.set("auth", options.actor ?? actor);
        await next();
      },
    }),
  );
  const request = (path, body, method = "POST") =>
    app.request(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { ...f, app, request };
}
const root = "/admin/duplicateGroups";
Deno.test("FAB-3 HTTP integration: list, resolve without note and reverse use real Controller and Service", async () => {
  const f = harness();
  const empty = await f.request(root, undefined, "GET");
  assert(
    empty.status === 200 &&
      (await empty.json()).data.duplicate_groups.length === 0,
  );
  const { note: _note, ...withoutNote } = input;
  const created = await f.request(root, withoutNote);
  const body = await created.json();
  assert(created.status === 201, JSON.stringify(body));
  const group = body.data.duplicate_group;
  assert(group.report_ids.length === 3 && group.resolved_at.endsWith("Z"));
  assert(!("resolved_by" in group) && !("note" in group));
  assert(created.headers.get("X-Request-Id"));
  assert(
    (await (await f.request(root, undefined, "GET")).json()).data
      .duplicate_groups.length === 1,
  );
  const conflict = await f.request(root, input);
  assert(
    conflict.status === 409 &&
      (await conflict.json()).error.code === "duplicate_membership_conflict",
  );
  const reversed = await f.request(`${root}/${group.id}/reverse`, {
    note: "Review candidates again",
  });
  assert(
    reversed.status === 200 &&
      (await reversed.json()).data.duplicate_group.status === "reversed",
  );
  assert(
    (await (await f.request(root, undefined, "GET")).json()).data
      .duplicate_groups.length === 0,
  );
  assert(
    (await f.request(`${root}/${group.id}/reverse`, { note: "Again" }))
      .status === 409,
  );
});
Deno.test("FAB-3 HTTP: malformed bodies, queries, IDs and methods never reach storage", async () => {
  const f = harness();
  for (
    const body of [{}, { ...input, status: "active" }, {
      ...input,
      report_ids: [uuid(1), uuid(1)],
    }]
  ) assert((await f.request(root, body)).status === 400);
  assert(
    (await f.request(`${root}?limit=10`, undefined, "GET")).status === 400,
  );
  assert(
    (await f.request(`${root}/bad/reverse`, { note: "review" })).status === 400,
  );
  assert((await f.request(`${root}/${uuid(200)}/reverse`, {})).status === 400);
  assert(
    (await f.app.request(`/api${root}`, {
      method: "POST",
      body: "{",
      headers: { "Content-Type": "application/json" },
    })).status === 400,
  );
  assert(
    (await f.app.request(`/api${root}`, {
      method: "POST",
      body: JSON.stringify(input),
    })).status === 400,
  );
  for (
    const [path, allow] of [[root, "GET, POST"], [
      `${root}/${uuid(200)}/reverse`,
      "POST",
    ]]
  ) {
    const response = await f.request(path, undefined, "DELETE");
    assert(response.status === 405 && response.headers.get("Allow") === allow);
  }
  assert(f.events.length === 0);
});
Deno.test("FAB-3 HTTP: disconnected groups, missing targets, roles and private errors are explicit", async () => {
  const f = harness();
  f.state().candidates.pop();
  const disconnected = await f.request(root, input);
  assert(
    disconnected.status === 409 &&
      (await disconnected.json()).error.code === "duplicate_graph_disconnected",
  );
  assert(
    (await f.request(`${root}/${uuid(999)}/reverse`, { note: "review" }))
      .status === 404,
  );
  const denied = harness({ actor: { ...actor, role: "association" } });
  assert((await denied.request(root, undefined, "GET")).status === 403);
  const failed = harness({
    repository: {
      readDuplicateActor: () => {
        throw new Error("SECRET SQL");
      },
    },
  });
  const response = await failed.request(root, undefined, "GET");
  assert(
    response.status === 500 && !(await response.text()).includes("SECRET"),
  );
});
Deno.test("FAB-3 HTTP: canonical app routes require authentication and preserve L1/L2", async () => {
  for (
    const [path, method] of [
      [root, "GET"],
      [root, "POST"],
      [`${root}/${uuid(200)}/reverse`, "POST"],
      ["/admin/configuration", "GET"],
      ["/admin/zoneSets", "POST"],
      ["/me", "GET"],
    ]
  ) {
    const response = await actualApp.request(`/api${path}`, { method });
    assert(
      response.status === 401 &&
        (await response.json()).error.code === "authentication_required",
      path,
    );
    assert(response.headers.has("X-Request-Id"));
  }
  assert((await actualApp.request(root)).status === 404);
  assert(
    (await actualApp.request(`/api${root}`, {
      headers: { Authorization: "not bearer" },
    })).status === 401,
  );
});
