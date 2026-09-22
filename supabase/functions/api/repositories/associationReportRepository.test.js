import { listAcceptedAssociationReports } from "./associationReportRepository.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

Deno.test("association repository query enforces accepted canonical five-year projection", async () => {
  let sqlText = "";
  let values = [];
  const tx = (strings, ...parameters) => {
    sqlText = strings.join("?");
    values = parameters;
    return Promise.resolve([]);
  };

  await listAcceptedAssociationReports(tx, {
    from: null,
    to: null,
    limit: 25,
    cursor: null,
  });

  assert(
    sqlText.includes("r.status = 'visible'"),
    "must select only published accepted reports",
  );
  assert(
    sqlText.includes("now() - interval '5 years'"),
    "must enforce five-year retention window",
  );
  assert(
    sqlText.includes("dm.member_role = 'duplicate'"),
    "must exclude active non-canonical reports",
  );
  assert(
    sqlText.includes("pa.state = 'approved'"),
    "must expose only sanitized-photo availability",
  );
  assert(
    sqlText.includes("ORDER BY r.accepted_at DESC, r.id DESC"),
    "must use stable keyset order",
  );
  assert(
    !sqlText.includes("device_fingerprint_hash"),
    "must not select fingerprints",
  );
  assert(!sqlText.includes("report_flags"), "must not select flags");
  assert(
    !sqlText.includes("trust_score"),
    "must not select trust or moderation data",
  );
  assert(
    values.includes(26),
    "must fetch one extra row to determine the next cursor",
  );
});
