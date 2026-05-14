# API Endpoint Reference

## Auth

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /auth/register | Register new user | Public |
| POST | /auth/login | Login | Public |
| POST | /auth/refresh | Refresh access token | Public |
| POST | /auth/logout | Revoke refresh token | Required |

## Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /users/me | Current user profile + property roles |
| GET | /users/search?q= | Search users (for adding to property) |

## Properties

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties | List accessible properties |
| POST | /properties | Create property |
| GET | /properties/:id | Property details |
| PATCH | /properties/:id | Update property |

## Rooms & Beds

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/:propertyId/rooms | List rooms with beds |
| POST | /properties/:propertyId/rooms | Create room (auto-creates beds) |
| GET | /beds/available?propertyId= | Available beds in property |

## Financial Model

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /properties/:propertyId/financial-model | Active model |
| GET | /properties/:propertyId/financial-model/history | All models |
| POST | /properties/:propertyId/financial-model | Set model |

## Tenants

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /tenants | List tenants (filterable) |
| POST | /tenants | Add lead |
| GET | /tenants/:id | Tenant details |
| PUT | /tenants/:id/schedule-visit | Schedule visit |
| PUT | /tenants/:id/mark-visited | Mark visited |
| PUT | /tenants/:id/finalize-room | Finalize room |
| PUT | /tenants/:id/move-in | Move in |
| PUT | /tenants/:id/initiate-notice | Start notice period |
| PUT | /tenants/:id/move-out | Move out |
| PUT | /tenants/:id/transfer-room | Room transfer |

## Rent

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /rent/generate-cycles | Generate monthly cycles |
| POST | /rent/payment | Record payment |
| GET | /rent/tenant/:id/cycles | Tenant's rent cycles |
| GET | /rent/property/:id/summary | Monthly collection summary |
| PUT | /rent/mark-overdue | Mark overdue cycles (scheduler) |

## Settlements

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /settlements/calculate | Calculate settlement |
| PUT | /settlements/:id/mark-paid | Mark as paid |
| GET | /settlements/property/:id | Settlement history |

## Complaints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /complaints?propertyId= | List complaints |
| POST | /complaints | Raise complaint |
| GET | /complaints/:id | Complaint details |
| PUT | /complaints/:id | Update status/assignment/comment |

## Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /dashboard/operator | Operator dashboard (all properties) |
| GET | /dashboard/tenant | Tenant dashboard (current user) |

## Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /notifications | List notifications |
| PUT | /notifications/:id/read | Mark read |
| PUT | /notifications/mark-all-read | Mark all read |
