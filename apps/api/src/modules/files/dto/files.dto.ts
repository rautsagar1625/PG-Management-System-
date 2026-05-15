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
