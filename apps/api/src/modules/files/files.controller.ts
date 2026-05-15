import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FileEntityType } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestContext } from '@pg-system/types';
import { ConfirmUploadDto, CreateUploadUrlDto } from './dto/files.dto';
import { FilesService } from './files.service';

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Step 1 of upload: request a presigned PUT URL.
   * The client uploads the file directly to S3/R2 using this URL,
   * then calls /files/confirm/:id to register the upload.
   */
  @Post('upload-url')
  @ApiOperation({ summary: 'Get presigned upload URL (direct browser → S3 upload)' })
  requestUpload(@Body() dto: CreateUploadUrlDto, @CurrentUser() user: RequestContext) {
    return this.filesService.requestUpload(dto, user.userId);
  }

  /** Step 2 of upload: confirm the file was successfully uploaded to S3. */
  @Post('confirm/:id')
  @ApiOperation({ summary: 'Confirm file upload completed' })
  confirmUpload(
    @Param('id') id: string,
    @Body() dto: ConfirmUploadDto,
    @CurrentUser() user: RequestContext,
  ) {
    return this.filesService.confirmUpload(id, user.userId, dto);
  }

  /** Get a time-limited presigned download URL for a file. */
  @Get(':id/download-url')
  @ApiOperation({ summary: 'Get presigned download URL (expires in 1 hour)' })
  getDownloadUrl(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.filesService.getDownloadUrl(id, user.userId);
  }

  /** List all uploaded files for a given entity. */
  @Get('entity/:type/:id')
  @ApiOperation({ summary: 'List all files for an entity (tenant, complaint, etc.)' })
  listForEntity(@Param('type') type: FileEntityType, @Param('id') id: string) {
    return this.filesService.listForEntity(type, id);
  }

  /** Soft-delete a file (keeps S3 object for recovery, marks as DELETED in DB). */
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a file' })
  softDelete(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.filesService.softDelete(id, user.userId);
  }
}
