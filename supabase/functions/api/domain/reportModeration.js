/**
 * @module domain/reportModeration
 * Report moderation state machine: statuses and the allowed transitions for each moderation command.
 * Pure domain logic; Services enforce authorization (ADR-019) and Repositories persist the transition.
 */
/** @typedef {'pending_review' | 'visible' | 'hidden' | 'deleted'} ReportStatus */
/** @typedef {'approve' | 'hide' | 'delete' | 'restore'} ModerationCommand */
/**
 * All report statuses.
 * @type {ReportStatus[]}
 */
export const REPORT_STATUSES = ['pending_review', 'visible', 'hidden', 'deleted'];

/**
 * Transition table: the statuses each command accepts and the status it produces.
 * @type {Record<ModerationCommand, {from: ReportStatus[], to: ReportStatus}>}
 */
export const MODERATION_COMMANDS = {
  approve: {
    from: ['pending_review', 'hidden'],
    to: 'visible',
  },
  hide: {
    from: ['pending_review', 'visible'],
    to: 'hidden',
  },
  delete: {
    from: ['pending_review', 'visible', 'hidden'],
    to: 'deleted',
  },
  restore: {
    from: ['hidden', 'deleted'],
    to: 'pending_review',
  },
};

/**
 * @param {string} command - Moderation command name.
 * @param {string} fromStatus - Current report status.
 * @returns {boolean} True when the command is known and allowed from that status.
 */
export function canTransition(command, fromStatus) {
  const rule = MODERATION_COMMANDS[command];
  return Boolean(rule && rule.from.includes(fromStatus));
}

/**
 * @param {string} command - Moderation command name.
 * @returns {ReportStatus | null} Target status, or null for an unknown command.
 */
export function nextStatus(command) {
  const rule = MODERATION_COMMANDS[command];
  return rule ? rule.to : null;
}

/**
 * @param {string} fromStatus - Current report status.
 * @returns {ModerationCommand[]} Commands that may be applied from that status.
 */
export function allowedCommands(fromStatus) {
  return Object.keys(MODERATION_COMMANDS).filter((command) =>
    canTransition(command, fromStatus),
  );
}

/**
 * Ensures a transition is allowed and returns its target status.
 * @param {string} command - Moderation command name.
 * @param {string} fromStatus - Current report status.
 * @returns {ReportStatus} Target status.
 * @throws {Error} With `code` `invalid_<command>_transition` (for example `invalid_approve_transition`).
 */
export function assertTransition(command, fromStatus) {
  if (!canTransition(command, fromStatus)) {
    const error = new Error(`invalid_${command}_transition`);
    error.code = `invalid_${command}_transition`;
    throw error;
  }
  return nextStatus(command);
}
