# Deployment and Operations

## Topology

One OVHcloud VPS (minimum 4 vCPU/8 GB RAM, Beauharnois region) runs Dokploy and
two logically isolated Supabase stacks:

| Boundary | Production | Staging |
|---|---|---|
| Database/Auth/Storage | Dedicated stack and volumes | Dedicated stack and volumes |
| Secrets/keys/JWT signing | Production-only | Staging-only |
| Domain/TLS | Production domain | Staging domain |
| Backups | Independent schedule/destination | Independent or explicitly disposable policy |
| Lifecycle | Always intended to run | Start for validation; stop immediately afterward |

They share physical CPU, RAM, disk, network, Dokploy, and failure domain. This is
not high availability. Prototype availability is best effort; 99.9% is a future
service target.

## Environment bootstrap

1. Harden SSH (keys only, no password/root login), OS firewall, OVH network
   firewall, unattended security updates, and operator MFA where supported.
2. Expose only HTTPS 443 publicly and restrict SSH 22. Keep PostgreSQL, Studio,
    Envoy internals, and container ports private. Kong is not part of the default
    stack.
3. Install/pin Dokploy and self-hosted Supabase `self-hosted/v0.8.0` (Postgres
    `17.6.1.136`, Envoy `v1.39.0`, Storage `v1.60.4`, Auth `v2.189.0`). Record
    image digests. Confirm those versions before Auth/Storage migrations.
4. Create separate Production/Staging projects, networks, volumes, domains,
   credentials, Storage namespaces, and backup jobs.
5. Set `deployment_metadata.environment` through an environment-specific migration.
6. Disable public Auth signup/providers and provision named accounts through the
   operator runbook in `SECURITY.md`.
7. Apply ordered migrations with the dedicated application owner. Verify function
   owners, search paths, RLS, revokes, and narrow grants.
8. Configure the image worker and rate limits without exposing service credentials.
9. Configure and restrict the environment-specific MapTiler public key; verify
   attribution, quota alerts, and the approved plan.
10. Import/test the candidate zone in Staging. Activate in Production only with an
   explicit Association approval reference for that checksum/version.

Do not apply `db/schema.sql` blindly to a populated database; it is the target from
which implementation migrations are derived.

## Migration promotion

1. Back up Staging and start it.
2. Apply the migration; run SQL/RLS/API/image/E2E checks and a rollback rehearsal.
3. Stop Staging and review resource graphs for contention.
4. Take/verify the Production pre-change backup.
5. Apply the identical migration checksum during a controlled window.
6. Run smoke and negative-authorization tests; roll back only via the rehearsed
   migration/restore plan.

Never copy Production data into Staging unless it is explicitly de-identified and
approved. Never share JWT secrets, service keys, Storage credentials, or domains.

## Backups and restoration

- Encrypted daily database backups target RPO ≤24 hours. Store copies off the live
  VPS/failure domain and define retention/rotation.
- Infrastructure snapshots supplement database backups; they do not replace them.
- Back up required Storage objects/configuration consistently enough to rebuild
  approved images and service routing.
- Quarterly prototype restore drills measure RTO ≤4 hours: provision an isolated
  target, restore database and required objects, run integrity/access smoke tests,
  document elapsed time, and destroy the drill environment.
- A backup is not considered successful until restoration is tested.

## Retention operations

Run `service_run_retention()` daily under the trusted worker identity. It uses
server `now()`, clears fingerprint hashes, marks purge-eligible photos (including
those whose parent report is eligible even if `purge_after` is NULL), purges old
audits, and hard-deletes eligible reports only when Storage cleanup is
acknowledged. The Storage worker retries object deletion and acknowledges each
purge. Alert on stuck `purge_pending` rows, worker failures, and unexpected delete
volume.

## Monitoring and contention

Monitor host and per-stack CPU, memory, swap, disk capacity/IO, container health,
HTTP latency/error rate, Auth failures, Postgres connections/slow queries, backup
age, certificate expiry, queue depth, image failures/orphans, retention lag, and
security-relevant audit volume.

Starting Staging can degrade Production. Before start, check capacity; during use,
watch pressure and stop validation if Production SLO indicators degrade. After use,
stop Staging containers and confirm resources are released.

## Incident priorities

1. Protect/rotate secrets and disable compromised profiles/sessions.
2. Preserve logs and audit evidence.
3. Restore service/data from verified backups if integrity is uncertain.
4. Keep Production intake fail-closed when no approved geofence is active.
5. Communicate that single-VPS outages have no automatic failover.
