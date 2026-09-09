export const REPORT_STATUSES = ['pending_review', 'visible', 'hidden', 'deleted'];

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

export function canTransition(command, fromStatus) {
  const rule = MODERATION_COMMANDS[command];
  return Boolean(rule && rule.from.includes(fromStatus));
}

export function nextStatus(command) {
  const rule = MODERATION_COMMANDS[command];
  return rule ? rule.to : null;
}

export function allowedCommands(fromStatus) {
  return Object.keys(MODERATION_COMMANDS).filter((command) =>
    canTransition(command, fromStatus),
  );
}

export function assertTransition(command, fromStatus) {
  if (!canTransition(command, fromStatus)) {
    const error = new Error(`invalid_${command}_transition`);
    error.code = `invalid_${command}_transition`;
    throw error;
  }
  return nextStatus(command);
}
