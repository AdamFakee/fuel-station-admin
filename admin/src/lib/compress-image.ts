/** Dung lượng tối đa ảnh khuôn mặt máy chấm công Hikvision chấp nhận (byte). */
export const FACE_IMAGE_MAX_BYTES = 200 * 1024;

/** Mục tiêu nén hơi thấp hơn trần để chắc chắn lọt dưới giới hạn. */
const TARGET_BYTES = 180 * 1024;
const MAX_SIDE_PX = 800;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Giảm dung lượng ảnh xuống dưới `FACE_IMAGE_MAX_BYTES`: thu nhỏ cạnh dài tối đa 800px rồi hạ dần chất lượng JPEG,
 * nếu vẫn lớn thì thu nhỏ thêm. Ảnh đã nhỏ hơn giới hạn thì giữ nguyên. Ảnh vẫn chính diện, rõ nét cho nhận diện.
 */
export async function compressFaceImage(file: File): Promise<File> {
  if (file.size <= FACE_IMAGE_MAX_BYTES) return file;

  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));

  for (let round = 0; round < 6; round++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) break;
    context.fillStyle = '#ffffff'; // ảnh PNG trong suốt thì nền trắng
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob && blob.size <= TARGET_BYTES) {
        bitmap.close();
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], name, { type: 'image/jpeg' });
      }
    }
    scale *= 0.8;
  }
  bitmap.close();
  throw new Error('Không thể nén ảnh xuống dưới 200 KB');
}
