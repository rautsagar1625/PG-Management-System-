import { api } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileRecord {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresIn: number;
  fileName: string;
  mimeType: string;
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Upload a file by sending it as base64. Intended for mobile — skips the
 * 3-step presigned URL flow and handles the S3 upload server-side.
 */
export async function uploadBase64(dto: {
  entityType: string;   // e.g. 'TENANT_KYC'
  entityId: string;
  fileName: string;
  mimeType: string;
  base64Data: string;  // with or without data-URI prefix
}): Promise<FileRecord> {
  const res = await api.post<{ success: boolean; data: FileRecord }>('/files/upload-base64', dto);
  return res.data;
}

/**
 * Get a time-limited presigned download URL for a previously uploaded file.
 * Expires in 1 hour — do not cache this URL.
 */
export async function getDownloadUrl(fileId: string): Promise<DownloadUrlResponse> {
  const res = await api.get<{ success: boolean; data: DownloadUrlResponse }>(`/files/${fileId}/download-url`);
  return res.data;
}

/**
 * List all confirmed uploads for a given entity.
 */
export async function listFilesForEntity(
  entityType: string,
  entityId: string,
): Promise<FileRecord[]> {
  const res = await api.get<{ success: boolean; data: FileRecord[] }>(
    `/files/entity/${entityType}/${entityId}`,
  );
  return res.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Determines if a stored `fileUrl` string is a FileRecord ID reference
 * (stored as `file://<uuid>`) vs a plain HTTPS URL.
 */
export function parseFileUrl(fileUrl: string | null): { type: 'fileId'; id: string } | { type: 'url'; url: string } | null {
  if (!fileUrl) return null;
  if (fileUrl.startsWith('file://')) {
    return { type: 'fileId', id: fileUrl.slice(7) };
  }
  return { type: 'url', url: fileUrl };
}
