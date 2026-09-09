export async function getDeploymentEnvironment(tx) {
  const rows = await tx`
    SELECT environment
    FROM public.deployment_metadata
    WHERE singleton = TRUE
  `;
  return rows[0]?.environment ?? null;
}

export async function prepareRetention(tx) {
  const rows = await tx`SELECT app_private.prepare_retention() AS counts`;
  return rows[0].counts;
}

export function listPendingPhotoPurges(tx) {
  return tx`
    SELECT id, approved_object_path
    FROM public.photo_assets
    WHERE state = 'purge_pending'
    ORDER BY created_at, id
  `;
}

export async function acknowledgePhotoPurge(tx, photoId) {
  const rows = await tx`
    SELECT app_private.acknowledge_photo_purge(${photoId}) AS acknowledged
  `;
  return rows[0].acknowledged === true;
}

export async function finalizeRetention(tx) {
  const rows = await tx`SELECT app_private.finalize_retention() AS counts`;
  return rows[0].counts;
}
