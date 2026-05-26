'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Suspense } from 'react';

function PaymentSuccessContent() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const razorpay_payment_id = params.get('razorpay_payment_id');
    const razorpay_order_id   = params.get('razorpay_order_id');
    const razorpay_signature  = params.get('razorpay_signature');

    if (razorpay_payment_id && razorpay_order_id && razorpay_signature) {
      apiClient
        .post('/tenant-self/pay/verify', {
          razorpayOrderId:   razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        })
        .then(() => {
          toast.success('Payment verified! Receipt will be emailed to you.');
        })
        .catch(() => {
          toast.error('Payment recorded but verification pending. Our team will update shortly.');
        });
    }

    const timer = setTimeout(() => router.push('/tenant/dashboard'), 4000);
    return () => clearTimeout(timer);
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Payment Successful!</h1>
        <p className="text-gray-500 text-sm">
          Your rent payment has been received. A receipt will be sent to your email.
        </p>
        <p className="text-xs text-gray-400">Redirecting to your dashboard…</p>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <PaymentSuccessContent />
    </Suspense>
  );
}
