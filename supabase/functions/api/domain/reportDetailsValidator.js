/**
 * @module domain/reportDetailsValidator
 * Validates the incident-specific `details` object of a report submission. Allowed keys and value rules
 * depend on the incident type (and sighting type for `avistamiento_simple`). Pure logic with no I/O.
 */
function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** Builds the `invalid_details` failure result. */
function invalid(message) {
  return { ok: false, code: "invalid_details", message };
}

/** Validates the optional free-text `descripcion` (string up to 2000 characters). */
function validateDescription(details) {
  if (
    Object.hasOwn(details, "descripcion") &&
    (typeof details.descripcion !== "string" ||
      details.descripcion.length > 2000)
  ) {
    return invalid(
      "details.descripcion must be a string up to 2000 characters.",
    );
  }
  return { ok: true };
}

/**
 * Validates report details for the given incident type. Returns a result instead of throwing.
 * @param {object} options
 * @param {string} options.incidentType - Incident type (see `INCIDENT_TYPES` in `domain/publicMap.js`).
 * @param {string} [options.sightingType] - Sighting type (`solitario` or `manada`) for `avistamiento_simple`.
 * @param {unknown} options.details - Details object from the request.
 * @returns {{ok: true} | {ok: false, code: 'invalid_details', message: string}}
 */
export function validateReportDetails({ incidentType, sightingType, details }) {
  if (!isPlainObject(details)) {
    return invalid("details must be an object.");
  }

  const description = validateDescription(details);
  if (!description.ok) {
    return description;
  }

  if (incidentType === "avistamiento_simple") {
    if (!hasOnlyKeys(details, ["cantidad_aprox", "descripcion"])) {
      return invalid(
        "details contains an unsupported field for avistamiento_simple.",
      );
    }
    if (
      Object.hasOwn(details, "cantidad_aprox") &&
      !isIntegerInRange(details.cantidad_aprox, 1, 1000)
    ) {
      return invalid(
        "details.cantidad_aprox must be an integer from 1 to 1000.",
      );
    }
    if (
      sightingType === "solitario" &&
      Object.hasOwn(details, "cantidad_aprox") &&
      details.cantidad_aprox !== 1
    ) {
      return invalid("solitario reports may only use cantidad_aprox 1.");
    }
    if (
      sightingType === "manada" &&
      !isIntegerInRange(details.cantidad_aprox, 2, 1000)
    ) {
      return invalid("manada reports require cantidad_aprox from 2 to 1000.");
    }
    return { ok: true };
  }

  if (incidentType === "ataque_humano") {
    if (!hasOnlyKeys(details, ["hubo_mordida", "descripcion"])) {
      return invalid(
        "details contains an unsupported field for ataque_humano.",
      );
    }
    if (typeof details.hubo_mordida !== "boolean") {
      return invalid("details.hubo_mordida must be boolean.");
    }
    return { ok: true };
  }

  if (incidentType === "ataque_mascota") {
    if (
      !hasOnlyKeys(details, ["tipo_animal", "resulto_herido", "descripcion"])
    ) {
      return invalid(
        "details contains an unsupported field for ataque_mascota.",
      );
    }
    if (typeof details.tipo_animal !== "string") {
      return invalid("details.tipo_animal must be a string.");
    }
    if (
      Object.hasOwn(details, "resulto_herido") &&
      typeof details.resulto_herido !== "boolean"
    ) {
      return invalid("details.resulto_herido must be boolean.");
    }
    return { ok: true };
  }

  if (incidentType === "ataque_ganado") {
    if (
      !hasOnlyKeys(details, ["tipo_animal", "cantidad_afectada", "descripcion"])
    ) {
      return invalid(
        "details contains an unsupported field for ataque_ganado.",
      );
    }
    if (typeof details.tipo_animal !== "string") {
      return invalid("details.tipo_animal must be a string.");
    }
    if (!isIntegerInRange(details.cantidad_afectada, 1, 1000)) {
      return invalid(
        "details.cantidad_afectada must be an integer from 1 to 1000.",
      );
    }
    return { ok: true };
  }

  if (incidentType === "perro_lastimado") {
    if (!hasOnlyKeys(details, ["situacion", "descripcion"])) {
      return invalid(
        "details contains an unsupported field for perro_lastimado.",
      );
    }
    if (
      !["herido", "atropellado", "atrapado", "mal_estado"].includes(
        details.situacion,
      )
    ) {
      return invalid("details.situacion is not supported.");
    }
    return { ok: true };
  }

  if (incidentType === "otro") {
    if (!hasOnlyKeys(details, ["descripcion"])) {
      return invalid("details contains an unsupported field for otro.");
    }
    return { ok: true };
  }

  return invalid("incident_type is not supported.");
}
