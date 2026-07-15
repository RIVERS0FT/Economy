export function canAcceptRevision(currentRevision: number | null, incomingRevision: number | undefined) {
  if (typeof incomingRevision !== 'number' || !Number.isInteger(incomingRevision)) return false;
  return currentRevision === null || incomingRevision >= currentRevision;
}
