# API Standards & Response Contracts

## Base URL

```
Production: https://api.pgsystem.com/api/v1
Development: http://localhost:3001/api/v1
```

## Authentication

All endpoints (except `/auth/*`) require:
```
Authorization: Bearer <access_token>
```

Access tokens expire in 15 minutes.
Use refresh token to get new access token:
```
POST /auth/refresh  { "refreshToken": "..." }
```

## Response Envelope

**All responses use this envelope:**

```typescript
{
  "success": true,
  "data": <T>,           // Present on success
  "meta": {              // Present on paginated responses
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}

// On error:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": { ... }  // Optional, present for validation errors
  }
}
```

## HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Success (GET, PUT, PATCH) |
| 201 | Created (POST) |
| 400 | Bad request (invalid data, invalid state transition) |
| 401 | Unauthorized (missing/expired token) |
| 403 | Forbidden (valid token, insufficient permission) |
| 404 | Not found |
| 409 | Conflict (duplicate, constraint violation) |
| 422 | Validation error (Zod/class-validator failure) |
| 429 | Too many requests |
| 500 | Internal server error |

## Pagination

Query params for paginated endpoints:
```
?page=1&limit=20&search=query&sortBy=createdAt&sortOrder=desc
```

## Error Codes

Standard error codes used in `error.code`:
- `UNAUTHORIZED` — not authenticated
- `FORBIDDEN` — not authorized
- `NOT_FOUND` — resource not found
- `CONFLICT` — duplicate or constraint violation
- `VALIDATION_ERROR` — input validation failed
- `INVALID_TRANSITION` — invalid workflow state transition
- `BUSINESS_RULE_VIOLATION` — violates a business rule
- `INTERNAL_ERROR` — unexpected server error

## Dates

All dates in API requests and responses use **ISO 8601 format**:
```
2024-01-15T10:30:00.000Z
```

Never send Unix timestamps. Never send local date strings.

## Money

All money values in API requests and responses are **numbers** (not strings).
No currency prefix. All amounts in Indian Rupees (INR).

Example: `"amount": 8000` means ₹8,000.

## IDs

All IDs are CUID strings.
Example: `"id": "clx1234abc567def"`

Never expose database auto-increment integers as public IDs.
