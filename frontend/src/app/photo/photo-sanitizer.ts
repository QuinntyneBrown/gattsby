const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_JPEG_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 1600;

export async function sanitizePhoto(file: Blob): Promise<Blob> {
  if (file.size === 0 || file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose a photo smaller than 20 MB.');
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return await encodePhoto(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export async function encodePhoto(source: CanvasImageSource, width: number, height: number) {
  if (width < 1 || height < 1)
    throw new Error('Wait for the camera preview before taking the photo.');
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This browser couldn’t prepare the photo.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (photo) => {
        if (photo?.type === 'image/jpeg' && photo.size <= MAX_JPEG_BYTES) resolve(photo);
        else reject(new Error('This photo couldn’t be saved as a JPEG under 2 MB.'));
      },
      'image/jpeg',
      0.85,
    ),
  );
}
