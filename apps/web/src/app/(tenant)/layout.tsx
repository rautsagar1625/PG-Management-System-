import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My PG — Tenant Portal',
  description: 'View your rent, payments, and raise complaints',
};

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
