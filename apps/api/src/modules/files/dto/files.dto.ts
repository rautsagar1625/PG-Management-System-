import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileEntityType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateUploadUrlDto {
  @ApiProperty({ enum: FileEntityType, description: 'What this file belongs to' })
  @IsEnum(FileEntityType)
  entityType: FileEntityType;

  @ApiProperty({ description: 'ID of the entity this file belongs to (tenantId, complaintId, etc.)' })
  @IsString()
  entityId: string;

  @ApiProperty({ example: 'aadhaar-card.pdf' })
  @IsString()
  @MaxLength(200)
  fileName: string;

  @ApiProperty({ example: 'application/pdf', description: 'Must be an allowed MIME type' })
  @IsString()
  mimeType: string;
}

export class ConfirmUploadDto {
  @ApiPropertyOptional({ description: 'Actual file size in bytes (from upload response)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}

/**
 * Used by mobile clients for server-side base64 upload.
 * The client sends the file as a base64 string; the server decodes and uploads to S3.
 */
export class UploadBase64Dto {
  @ApiProperty({ enum: FileEntityType })
  @IsEnum(FileEntityType)
  entityType: FileEntityType;

  @ApiProperty({ description: 'ID of the entity this file belongs to' })
  @IsString()
  entityId: string;

  @ApiProperty({ example: 'aadhaar-front.jpg' })
  @IsString()
  @MaxLength(200)
  fileName: string;

  @ApiProperty({ example: 'image/jpeg', description: 'MIME type of the file' })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: 'Base64-encoded file content (with or without data-URI prefix)' })
  @IsString()
  base64Data: string;
}
