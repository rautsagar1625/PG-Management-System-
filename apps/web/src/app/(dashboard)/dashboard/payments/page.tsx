'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/collections'); }, [router]);
  return null;
}
