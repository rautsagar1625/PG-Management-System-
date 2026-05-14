# Complaint & Maintenance Workflow

## Overview

Complaints and maintenance requests follow a structured lifecycle with
assignment, progress tracking, and resolution.

## Who Can Raise Complaints

- Tenants (via mobile app)
- Operators/Staff (on behalf of tenants or property issues)

## Status Flow

```
OPEN
  ↓ (assigned to staff)
ASSIGNED
  ↓ (work begins)
IN_PROGRESS
  ↓ (work completed)
RESOLVED
  ↓ (tenant/operator confirms)
CLOSED
```

Alternative paths:
```
OPEN → REJECTED (invalid/duplicate)
IN_PROGRESS → ASSIGNED (reassigned)
RESOLVED → IN_PROGRESS (issue recurred)
```

## Priority Levels

- LOW: General feedback, non-urgent requests
- MEDIUM: Issues affecting comfort (default)
- HIGH: Issues affecting daily routine (no hot water, WiFi down)
- URGENT: Safety concerns, flooding, electrical hazards

## Categories

MAINTENANCE, PLUMBING, ELECTRICAL, HOUSEKEEPING, SECURITY, FOOD, WIFI, NOISE, OTHER

## Comments Thread

Every status change or communication is stored as a comment.
Comments are ordered chronologically and visible to all parties with access.

## Escalation (Future)

- If complaint stays ASSIGNED > 24h without IN_PROGRESS: alert operator
- If IN_PROGRESS > 48h without RESOLVED: alert owner
- URGENT complaints: immediate notification to operator

## Complaint Metrics

Tracked per property:
- openCount: OPEN + ASSIGNED + IN_PROGRESS
- averageResolutionTime
- byCategory breakdown
- overdueCount (unresolved > 3 days for HIGH/URGENT)

Visible on operator dashboard.
