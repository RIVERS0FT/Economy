export function canAcceptRevision(currentRevision, incomingRevision) {
  if (typeof incomingRevision !== 'number' || !Number.isInteger(incomingRevision)) return false;
  return currentRevision === null || incomingRevision >= currentRevision;
}
