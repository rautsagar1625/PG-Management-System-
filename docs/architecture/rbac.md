# Role-Based Access Control

Access control in this system is **property-scoped**. A user's role is not global — it applies to a specific property.

---

## Why Property-Scoped RBAC

A single user can hold different roles across different properties:
- Own `Property A`
- Operate `Property B` for another owner
- Be staff at `Property C`

This means access checks always require both the user identity AND the property context.

---

## Roles

### OWNER

The property owner. Has full visibility and control.

**Permissions**:
- View all financial data (rent collection, settlements, model history)
- Configure financial models (FIXED_PAYOUT, REVENUE_SHARE, OWNER_OPERATED)
- Add and remove users from property roles
- View all tenants, complaints, and announcements
- Generate and view settlements

### OPERATOR

Manages day-to-day PG operations on behalf of the owner.

**Permissions**:
- Full tenant lifecycle management (onboarding → move-out)
- Record rent payments and generate receipts
- Manage complaints (assign, resolve)
- Manage rooms and bed assignments
- View operational financials (collections, pending dues)

**Restrictions**:
- Cannot configure financial models
- Cannot view owner settlement payouts

### CO_OPERATOR

Shared operations access, typically a business partner.

**Permissions**: Same as OPERATOR

### STAFF

Daily operations — typically a warden or caretaker.

**Permissions**:
- View tenant list and room status
- Handle complaints (create, comment, update status)
- View rent status per tenant

**Restrictions**:
- Cannot record payments
- Cannot move tenants in/out
- Cannot view financial summaries

### TENANT

Limited self-service access.

**Permissions**:
- View own rent history and current dues
- View own receipts
- Create and view own complaints

**Restrictions**:
- Cannot view other tenants
- Cannot access any financial data beyond their own dues

---

## Permission Matrix

| Action | OWNER | OPERATOR | CO_OPERATOR | STAFF | TENANT |
|---|:---:|:---:|:---:|:---:|:---:|
| View financial model | ✓ | - | - | - | - |
| Set financial model | ✓ | - | - | - | - |
| Generate settlement | ✓ | - | - | - | - |
| Tenant onboarding | ✓ | ✓ | ✓ | - | - |
| Record rent payment | ✓ | ✓ | ✓ | - | - |
| View all tenants | ✓ | ✓ | ✓ | ✓ | - |
| View own rent | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create complaint | ✓ | ✓ | ✓ | ✓ | ✓ |
| Resolve complaint | ✓ | ✓ | ✓ | ✓ | - |
| Assign user roles | ✓ | - | - | - | - |

---

## Implementation

Roles are stored in `PropertyRole`:

```prisma
model PropertyRole {
  id         String   @id @default(uuid())
  propertyId String
  userId     String
  role       UserRole
  createdAt  DateTime @default(now())

  @@unique([propertyId, userId])
}
```

The `JwtAuthGuard` verifies the JWT and populates `request.user`. Property-specific role checks are performed in the service layer by querying `PropertyRole` for the given `propertyId` and `userId`.

---

## Access Check Pattern

```typescript
// In service
const role = await this.prisma.propertyRole.findUnique({
  where: { propertyId_userId: { propertyId, userId } },
});

if (!role || !ALLOWED_ROLES.includes(role.role)) {
  throw new ForbiddenException('Insufficient permissions');
}
```
