# API Specifications

API contracts for all modules in the PG Management System.

Base URL: `http://localhost:3001/api`

---

## Standard Response Envelope

All endpoints return the same envelope structure.

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["field: reason"],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Authentication

All protected routes require:
```
Authorization: Bearer <access_token>
```

Token lifetime: 15 minutes (access), 7 days (refresh).

---

## Auth Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Register new user |
| POST | `/api/auth/login` | None | Login, receive tokens |
| POST | `/api/auth/refresh` | Refresh token | Rotate refresh token |
| POST | `/api/auth/logout` | Bearer | Invalidate refresh token |
| GET | `/api/auth/me` | Bearer | Current user profile |

---

## Property Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/properties` | Bearer | Create property |
| GET | `/api/properties` | Bearer | List user's properties |
| GET | `/api/properties/:id` | Bearer | Property details |
| PUT | `/api/properties/:id` | Bearer | Update property |
| POST | `/api/properties/:id/roles` | Bearer (OWNER) | Assign user role |

---

## Room Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/rooms?propertyId=` | Bearer | List rooms with beds |
| POST | `/api/rooms/:propertyId` | Bearer | Create room + auto-beds |
| PUT | `/api/rooms/:id/status` | Bearer | Update room status |

---

## Tenant Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/tenants?propertyId=` | Bearer | List tenants |
| POST | `/api/tenants` | Bearer | Create tenant lead |
| GET | `/api/tenants/:id` | Bearer | Tenant details |
| PUT | `/api/tenants/:id` | Bearer | Update tenant info |
| POST | `/api/tenants/:id/schedule-visit` | Bearer | Schedule visit |
| POST | `/api/tenants/:id/mark-visited` | Bearer | Mark visit done |
| POST | `/api/tenants/:id/finalize-room` | Bearer | Assign bed |
| POST | `/api/tenants/:id/move-in` | Bearer | Activate tenant |
| POST | `/api/tenants/:id/initiate-notice` | Bearer | Start notice period |
| POST | `/api/tenants/:id/move-out` | Bearer | Complete move-out |
| POST | `/api/tenants/:id/transfer` | Bearer | Transfer to another bed |

---

## Rent Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/rent?propertyId=` | Bearer | List rent cycles |
| GET | `/api/rent/:tenantId/history` | Bearer | Tenant payment history |
| POST | `/api/rent/generate?propertyId=` | Bearer | Generate monthly cycles |
| POST | `/api/rent/payment` | Bearer | Record payment |
| POST | `/api/rent/mark-overdue?propertyId=` | Bearer | Mark overdue cycles |

---

## Financial Model Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/financial/:propertyId/model` | Bearer (OWNER) | Set financial model |
| GET | `/api/financial/:propertyId/model` | Bearer | Get active model |
| GET | `/api/financial/:propertyId/history` | Bearer | Model history |

---

## Settlement Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/settlements/:propertyId/calculate` | Bearer (OWNER) | Calculate settlement |
| GET | `/api/settlements/:propertyId` | Bearer | Settlement history |

---

## Complaint Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/complaints?propertyId=` | Bearer | List complaints |
| POST | `/api/complaints` | Bearer | Raise complaint |
| GET | `/api/complaints/:id` | Bearer | Complaint + comments |
| PUT | `/api/complaints/:id` | Bearer | Update status/assign/comment |

---

## Dashboard Endpoint

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard/:propertyId` | Bearer | Property stats summary |

---

## Validation Rules

- All IDs: UUID format
- All monetary amounts: positive number, max 2 decimal places
- Phone numbers: 10-digit Indian mobile number
- Dates: ISO 8601 string
- Percentage shares: must sum to 100 for REVENUE_SHARE model

---

## Required Sections Per API Document

1. Endpoint and method
2. Authentication requirement
3. Request body with field types
4. Validation rules
5. Response structure with example
6. Error cases with HTTP codes
7. Permission rules (which roles can access)
8. Transaction logic (if financial)
