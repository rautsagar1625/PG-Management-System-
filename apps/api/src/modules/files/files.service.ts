import * as path from 'path';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileEntityType, FileStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import type { ConfirmUploadDto, CreateUploadUrlDto } from './dto/files.dto';

// Allowed MIME types → max upload size in bytes
const ALLOWED_MIME_TYPES = new Map<string, number>([
  ['image/jpeg', 5 * 1024 * 1024],
  ['image/png', 5 * 1024 * 1024],
  ['image/webp', 5 * 1024 * 1024],
  ['application/pdf', 20 * 1024 * 1024],
  [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    10 * 1024 * 1024,
  ],
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

const PRESIGNED_UPLOAD_TTL = 900;   // 15 minutes
const PRESIGNED_DOWNLOAD_TTL = 3600; // 1 hour

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly s3: S3Client | null = null;
  private readonly bucket: string;
  private readonly isConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const accessKeyId = config.get<string>('S3_ACCESS_KEY_ID', '');
    const secretAccessKey = config.get<string>('S3_SECRET_ACCESS_KEY', '');
    this.bucket = config.get<string>('S3_BUCKET', '');
    this.isConfigured = !!(accessKeyId && secretAccessKey && this.bucket);

    if (this.isConfigured) {
      const endpoint = config.get<string>('S3_ENDPOINT');
      this.s3 = new S3Client({
        region: config.get<string>('S3_REGION', 'auto'),
        credentials: { accessKeyId, secretAccessKey },
        ...(endpoint && { endpoint, forcePathStyle: false }),
      });
      this.logger.log(`File storage configured: bucket=${this.bucket}`);
    } else {
      this.logger.warn('File storage not configured — S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / S3_BUCKET missing');
    }
  }

  async requestUpload(dto: CreateUploadUrlDto, uploadedBy: string) {
    this.assertConfigured();

    const maxSizeBytes = ALLOWED_MIME_TYPES.get(dto.mimeType);
    if (!maxSizeBytes) {
      throw new BadRequestException(
        `MIME type "${dto.mimeType}" is not allowed. Allowed: ${[...ALLOWED_MIME_TYPES.keys()].join(', ')}`,
      );
    }

    const ext = MIME_TO_EXT[dto.mimeType] ?? '';
    const baseName = this.sanitizeFileName(dto.fileName);
    const key = `${dto.entityType.toLowerCase()}/${dto.entityId}/${crypto.randomUUID()}-${baseName}${ext}`;

    const fileUpload = await this.prisma.fileUpload.create({
      data: {
        key,
        bucket: this.bucket,
        fileName: path.basename(dto.fileName).slice(0, 200),
        mimeType: dto.mimeType,
        entityType: dto.entityType,
        entityId: dto.entityId,
        uploadedBy,
        status: FileStatus.PENDING,
      },
    });

    // Enforce content-type in presigned URL so the browser can't swap it
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.mimeType,
      Metadata: {
        'file-upload-id': fileUpload.id,
        'uploaded-by': uploadedBy,
        'entity-type': dto.entityType,
        'entity-id': dto.entityId,
      },
    });

    const uploadUrl = await getSignedUrl(this.s3!, command, {
      expiresIn: PRESIGNED_UPLOAD_TTL,
    });

    return { fileId: fileUpload.id, uploadUrl, key, expiresIn: PRESIGNED_UPLOAD_TTL, maxSizeBytes };
  }

  async confirmUpload(fileId: string, uploadedBy: string, dto: ConfirmUploadDto) {
    const file = await this.prisma.fileUpload.findFirst({
      where: { id: fileId, uploadedBy, status: FileStatus.PENDING },
    });
    if (!file) throw new NotFoundException('Upload record not found or already confirmed');

    return this.prisma.fileUpload.update({
      where: { id: fileId },
      data: {
        status: FileStatus.UPLOADED,
        ...(dto.sizeBytes && { sizeBytes: dto.sizeBytes }),
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, entityType: true, entityId: true, createdAt: true },
    });
  }

  async getDownloadUrl(fileId: string, requestingUserId: string) {
    this.assertConfigured();

    const file = await this.prisma.fileUpload.findUnique({ where: { id: fileId } });
    if (!file || file.status !== FileStatus.UPLOADED) {
      throw new NotFoundException('File not found');
    }

    // Only the uploader or admin can download — callers add role-level checks above this
    if (file.uploadedBy !== requestingUserId) {
      // We allow this and let the controller guard handle it — but log for audit
      this.logger.warn(`Download request: user=${requestingUserId} requested file uploaded by ${file.uploadedBy}`);
    }

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: file.key });
    const downloadUrl = await getSignedUrl(this.s3!, command, { expiresIn: PRESIGNED_DOWNLOAD_TTL });

    return { downloadUrl, expiresIn: PRESIGNED_DOWNLOAD_TTL, fileName: file.fileName, mimeType: file.mimeType };
  }

  async softDelete(fileId: string, requestingUserId: string) {
    const file = await this.prisma.fileUpload.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    if (file.uploadedBy !== requestingUserId) {
      throw new ForbiddenException('Cannot delete another user\'s file');
    }
    if (file.status === FileStatus.DELETED) {
      throw new BadRequestException('File is already deleted');
    }

    await this.prisma.fileUpload.update({
      where: { id: fileId },
      data: { status: FileStatus.DELETED },
    });

    // Keep S3 object — deletion is logical only (supports recovery)
    return { success: true };
  }

  async listForEntity(entityType: FileEntityType, entityId: string) {
    return this.prisma.fileUpload.findMany({
      where: { entityType, entityId, status: FileStatus.UPLOADED },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
    });
  }

  // Expire PENDING records older than 30 minutes (called by a cron)
  async expireStalePendingUploads() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const result = await this.prisma.fileUpload.updateMany({
      where: { status: FileStatus.PENDING, createdAt: { lt: thirtyMinutesAgo } },
      data: { status: FileStatus.FAILED },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale pending uploads`);
    }
    return result.count;
  }

  private assertConfigured() {
    if (!this.isConfigured || !this.s3) {
      throw new ServiceUnavailableException('File storage is not configured on this server');
    }
  }

  private sanitizeFileName(raw: string): string {
    const withoutExt = path.basename(raw, path.extname(raw));
    return withoutExt
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-{2,}/g, '-')
      .toLowerCase()
      .slice(0, 50);
  }
}
