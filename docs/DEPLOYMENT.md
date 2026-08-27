# Deployment

## Target environment

- **Host:** OVHcloud VPS, Beauharnois (Canada) region — closest to Mexico, no local
  region available. Minimum **4 vCPU / 8 GB RAM** (RNF15).
- **PaaS:** Dokploy (open-source self-hosted PaaS) on the VPS.
- **Backend:** Supabase self-hosted (Docker), deployed via Dokploy's Supabase
  template.

## High-level deploy steps

> This is the intended flow. Fill in exact commands/values as the environment is set
> up. Do not commit secrets.

1. **Provision the VPS** (OVHcloud). Enable OVHcloud network firewall; confirm
   Anti-DDoS availability for the plan.
2. **Harden the OS** (RNF16, RNF17):
   - SSH key-only; disable password auth and direct root login.
   - OS firewall (ufw/iptables): expose 443 public, 22 restricted; keep internal
     Supabase ports (Postgres, Kong, Studio) closed to the internet.
   - Automated OS security updates.
3. **Install Dokploy** on the VPS (requires the version supporting the Supabase
   template).
4. **Deploy Supabase** via Dokploy's one-click template (as a single grouped
   service, so the internal components share a network — do not split them into
   separate Dokploy services).
5. **Configure environment variables** in Dokploy (JWT secret, anon key,
   service_role key). The JWT secret must be consistent across services. Never create
   a manual `.env`; let Dokploy manage it.
6. **Apply the database schema**: run `db/schema.sql` via Supabase Studio SQL editor
   or as a migration. Then insert the real Creel polygon into `zones`.
7. **Traefik / TLS**: Dokploy's integrated Traefik handles routing and automatic
   Let's Encrypt certificates with HTTP→HTTPS redirect (RNF22). Point your domain at
   the VPS.
8. **Backups**: configure Dokploy's scheduled DB backups (daily; RPO 24h) and enable
   OVHcloud infra snapshots (RNF14, RNF18).
9. **Monitoring**: enable basic resource/log monitoring (CPU/RAM/disk, Supabase
   service logs) (RNF25).

## Important deploy notes

- **On-device ≠ server.** The dog classifier runs on the phone; the VPS never runs
  heavy ML. Keep it that way for the prototype.
- **Single VPS = no HA.** This is a known prototype limitation; replica/failover is a
  future improvement.
- **Patching is your responsibility.** Self-hosted Supabase images follow their own
  release cycle; schedule updates.
- **Studio is internal only** — reach it via the reverse proxy or internal network,
  never expose it publicly (RNF23).

## Mobile app builds

- Expo managed workflow; build for Android 8.0+ and iOS 13+.
- App configured with the Supabase URL and **anon key only**.

## Files

- `db/schema.sql` — database schema to apply.
- (Add here: Dokploy compose/template references, domain config, backup schedule as
  they're finalized.)
