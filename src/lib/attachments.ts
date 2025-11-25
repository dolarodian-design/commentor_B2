import { supabase } from './supabase';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  thumbnailUrl?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'video/mp4',
  'video/quicktime',
];

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return 'File size must be less than 10MB';
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'File type not supported';
  }

  return null;
}

export async function uploadAttachment(
  file: File,
  userId: string
): Promise<Attachment | null> {
  const error = validateFile(file);
  if (error) {
    throw new Error(error);
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('comment-attachments')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: urlData } = supabase.storage
    .from('comment-attachments')
    .getPublicUrl(filePath);

  return {
    id: fileName,
    name: file.name,
    size: file.size,
    type: file.type,
    url: urlData.publicUrl,
  };
}

export async function deleteAttachment(
  userId: string,
  fileId: string
): Promise<void> {
  const filePath = `${userId}/${fileId}`;

  const { error } = await supabase.storage
    .from('comment-attachments')
    .remove([filePath]);

  if (error) {
    throw error;
  }
}

export function getAttachmentUrl(userId: string, fileId: string): string {
  const filePath = `${userId}/${fileId}`;
  const { data } = supabase.storage
    .from('comment-attachments')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export function isImageFile(type: string): boolean {
  return type.startsWith('image/');
}

export function isVideoFile(type: string): boolean {
  return type.startsWith('video/');
}

export function isPdfFile(type: string): boolean {
  return type === 'application/pdf';
}

export function getFileIcon(type: string): string {
  if (isImageFile(type)) return '🖼️';
  if (isVideoFile(type)) return '🎥';
  if (isPdfFile(type)) return '📄';
  if (type.includes('word')) return '📝';
  if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
  if (type.includes('text')) return '📃';
  return '📎';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
