# Operator Change Behavior

## Scenario

The property owner decides to change who operates the PG.
Old operator leaves. New operator takes over.

## What Changes

- Old OPERATOR role: isActive = false, endDate = changeover date
- New OPERATOR role created: isActive = true, startDate = changeover date
- Financial model may be renegotiated (new fixed payout or share %)

## What Does NOT Change

- All existing tenants remain (unchanged)
- All past payment history remains
- All past settlements remain (belong to old operator period)
- Rooms and beds remain
- Past complaints remain (but future complaints go to new operator)

## Settlement Cutoff

On the changeover date:
1. Final settlement calculated for old operator (covering their last period)
2. Old operator's financial model deactivated
3. New financial model configured with new operator terms
4. New settlement period starts fresh

## Tenants During Changeover

Tenants experience no disruption:
- Rent cycles continue uninterrupted
- Rent amount does not change (locked in TenantBedAssignment)
- Only the person they pay to may change

## Adding a Co-Operator (Partnership)

To bring in a CO_OPERATOR:
1. Add new PropertyRole: userId=newPerson, role=CO_OPERATOR, sharePercent=40
2. Update existing OPERATOR sharePercent if needed
3. New financial model may be needed if profit split changes

## Removing a Partner

1. Set CO_OPERATOR role: isActive=false, endDate=today
2. Adjust remaining partner(s) sharePercent to total 100%
3. Financial model may need updating

## Access After Role Removal

Once isActive=false:
- User can no longer access property data
- Cannot record payments or manage tenants
- Historical data they created remains intact
