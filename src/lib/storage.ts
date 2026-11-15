import { supabase } from './supabase';

const BUCKET = 'theme-photos';
const MAX_SIDE = 1400;
const QUALITY = 0.82;

// Фото ужимается на клиенте перед загрузкой: с телефона прилетают 4–12 МБ,
// а для заглавного экрана хватает 1400 px по длинной стороне.
export async function uploadThemePhoto(userId: string, file: File): Promise<string> {
  const blob = await compressImage(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('bucket not found')) {
      throw new Error('Бакет theme-photos не создан — выполни supabase/schema.sql.');
    }
    if (message.includes('row-level security') || message.includes('policy')) {
      throw new Error('Нет прав на загрузку фото — проверь политики Storage (schema.sql).');
    }
    throw error;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Удаление старого фото — best effort: если файл уже убрали или политика
// не пускает, это не должно ломать сохранение темы.
export async function deleteThemePhoto(url: string): Promise<void> {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return;
  const path = decodeURIComponent(url.slice(index + marker.length));
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // ignore
  }
}

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Браузер не дал canvas — фото не сжать.');

  ctx.drawImage(bitmap.source, 0, 0, width, height);
  bitmap.release();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось сжать фото.'))),
      'image/jpeg',
      QUALITY,
    );
  });
}

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function loadBitmap(file: File): Promise<LoadedImage> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // iOS иногда не умеет createImageBitmap для HEIC — падаем на <img>.
    }
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('Не удалось прочитать изображение.');
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}
