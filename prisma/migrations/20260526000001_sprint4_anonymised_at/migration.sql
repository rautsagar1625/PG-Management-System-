-- SP4-6: DPDP-lite — add anonymisedAt to Tenant
-- Records when a tenant's PII was scrubbed on ARCHIVED transition.
-- Non-null = User.name/phone, TenantDocument numbers/URLs, and
-- EmergencyContact fields have been redacted for this tenant.

ALTER TABLE "Tenant" ADD COLUMN "anonymisedAt" TIMESTAMP(3);
