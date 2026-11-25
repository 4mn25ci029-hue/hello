const MAX_DATA_URL_LENGTH = 94000;

export interface CompressedPhotoResult {
  dataUrl: string;
  originalKB: number;
  compressedKB: number;
}

/**
 * Resizes and compresses a villager's uploaded image on the client so it stays
 * strictly under the 100,000-character Firestore rule limit while keeping crisp clarity.
 */
export async function compressIssueImage(file: File): Promise<CompressedPhotoResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (JPEG, PNG, or WebP).');
  }

  const originalKB = Math.max(1, Math.round(file.size / 1024));

  const bitmapUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode the selected image.'));
    image.src = bitmapUrl;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas compression is not available in this browser.');
  }

  let maxDim = 720;
  let quality = 0.72;
  let output = '';

  for (let attempt = 0; attempt < 7; attempt++) {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    output = canvas.toDataURL('image/jpeg', quality);
    if (output.length <= MAX_DATA_URL_LENGTH) {
      break;
    }
    quality = Math.max(0.32, quality - 0.1);
    maxDim = Math.max(320, Math.round(maxDim * 0.82));
  }

  if (output.length > MAX_DATA_URL_LENGTH) {
    throw new Error('Image is too complex to compress under the 95 KB portal limit. Please select a clearer or smaller photo.');
  }

  const compressedKB = Math.max(1, Math.round((output.length * 3) / 4 / 1024));
  return { dataUrl: output, originalKB, compressedKB };
}
