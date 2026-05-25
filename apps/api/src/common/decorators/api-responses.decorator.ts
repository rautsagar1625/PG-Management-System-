/**
 * Reusable Swagger @ApiResponse bundles for common HTTP status codes.
 *
 * Usage:
 *   @ApiOkResponse({ description: 'Dashboard data' })
 *   @ApiAuthResponses()
 *   @ApiStandardResponses()
 *
 * Or use the composite helpers:
 *   @ApiReadResponses()   → 200 + auth + not-found
 *   @ApiWriteResponses()  → 201 + auth + bad-request
 */

import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

/** 401 Unauthorized */
export const ApiUnauthorizedResponse = () =>
  ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Missing or invalid JWT token' });

/** 403 Forbidden */
export const ApiForbiddenResponse = () =>
  ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient role/permission for this resource' });

/** 404 Not Found */
export const ApiNotFoundResponse = () =>
  ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Requested resource not found' });

/** 400 Bad Request */
export const ApiBadRequestResponse = () =>
  ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed or invalid input data' });

/** 409 Conflict */
export const ApiConflictResponse = () =>
  ApiResponse({ status: HttpStatus.CONFLICT, description: 'Resource already exists or state conflict' });

/** Auth guard responses (401 + 403) */
export const ApiAuthResponses = () =>
  applyDecorators(ApiUnauthorizedResponse(), ApiForbiddenResponse());

/** Standard error responses for read endpoints: 401 + 403 + 404 */
export const ApiReadResponses = () =>
  applyDecorators(ApiUnauthorizedResponse(), ApiForbiddenResponse(), ApiNotFoundResponse());

/** Standard error responses for write endpoints: 400 + 401 + 403 */
export const ApiWriteResponses = () =>
  applyDecorators(ApiBadRequestResponse(), ApiUnauthorizedResponse(), ApiForbiddenResponse());

/** Full standard set: 400 + 401 + 403 + 404 */
export const ApiStandardResponses = () =>
  applyDecorators(
    ApiBadRequestResponse(),
    ApiUnauthorizedResponse(),
    ApiForbiddenResponse(),
    ApiNotFoundResponse(),
  );
