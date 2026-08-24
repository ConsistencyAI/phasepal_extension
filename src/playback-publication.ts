export function shouldPublishPlayback(
  previousFingerprint: string,
  nextFingerprint: string,
  forceHeartbeat: boolean
): boolean {
  return forceHeartbeat || previousFingerprint !== nextFingerprint;
}
