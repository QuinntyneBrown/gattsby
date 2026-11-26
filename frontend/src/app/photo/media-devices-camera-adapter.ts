// The camera adapter (read-a-model-plate-photo design). Journey 2 needs only its availability,
// which is a presence test: it never calls getUserMedia, so no prompt can appear (NFR-016).
export function cameraAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export async function openCamera(signal: AbortSignal): Promise<MediaStream> {
  signal.throwIfAborted();
  if (!cameraAvailable()) throw new Error('There is no camera available.');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  if (signal.aborted) {
    stopCamera(stream);
    signal.throwIfAborted();
  }
  return stream;
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
