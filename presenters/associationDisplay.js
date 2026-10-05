function translated(t, path, fallback) {
  return t(path, { defaultValue: fallback });
}

function dateTime(value, locale, includeTime = true) {
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

function yesNo(value, t, unknown) {
  return value === null ? unknown : t(value ? 'common.yes' : 'common.no');
}

export function presentAssociationReport(report, t, locale) {
  const unknown = t('associationDashboard.card.unknown');
  const details = Object.entries(report.details)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: translated(t, `reportForm.fields.${key}`, key.replaceAll('_', ' ')),
      value: typeof value === 'boolean' ? yesNo(value, t, unknown)
        : key === 'situacion' ? translated(t, `reportForm.situations.${value}`, value)
          : typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));

  return {
    id: report.id,
    incident: translated(t, `reportForm.incidents.${report.incident_type}`, report.incident_type),
    sighting: translated(t, `reportForm.sighting.${report.sighting_type}`, report.sighting_type),
    acceptedDate: dateTime(report.accepted_at, locale, false),
    acceptedAt: dateTime(report.accepted_at, locale),
    occurredAt: dateTime(report.occurred_at, locale),
    latitude: report.location.latitude,
    longitude: report.location.longitude,
    size: report.dog.size ? translated(t, `reportForm.dogSize.${report.dog.size}`, report.dog.size) : unknown,
    color: report.dog.predominant_color ?? unknown,
    collar: yesNo(report.dog.has_collar, t, unknown),
    photo: yesNo(report.has_sanitized_photo, t, unknown),
    details,
  };
}

export function associationDisplayValues(display) {
  return [display.id, display.acceptedAt, display.occurredAt, display.incident, display.sighting,
    display.details.map(({ label, value }) => `${label}: ${value}`).join(' · ') || '—',
    display.color, display.size, display.collar, display.longitude, display.latitude, display.photo];
}
