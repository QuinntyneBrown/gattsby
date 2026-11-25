// The camera adapter (read-a-model-plate-photo design). Journey 2 needs only its availability,
// which is a presence test: it never calls getUserMedia, so no prompt can appear (NFR-016).
export function cameraAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}
