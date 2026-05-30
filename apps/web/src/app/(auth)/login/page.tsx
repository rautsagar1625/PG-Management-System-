'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2, Eye, EyeOff, Loader2,
  ShieldCheck, TrendingUp, Users, IndianRupee,
} from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { FormField, Input } from '@/components/ui/FormField';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

const FEATURES = [
  { icon: IndianRupee, text: 'Real-time rent collections & overdue tracking' },
  { icon: Users,       text: 'Multi-property tenant lifecycle management' },
  { icon: TrendingUp,  text: 'Settlement reports & revenue analytics' },
  { icon: ShieldCheck, text: 'Role-based access for owners and staff' },
];

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [apiError, setApiError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setApiError('');
    try {
      await signIn(data);
      router.replace('/dashboard');
    } catch (err: unknown) {
      setValue('password', '');
      const msg = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setApiError(msg ?? 'Failed to sign in. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — gradient brand panel (hidden on mobile) */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between px-14 py-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #1e1b4b 0%, #312e81 40%, #4338ca 75%, #4f46e5 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #a5b4fc 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">PG Manager</p>
            <p className="text-indigo-200/60 text-xs mt-0.5">Operations Console</p>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Run your PG business<br />
              <span className="text-indigo-300">like a professional.</span>
            </h1>
            <p className="text-indigo-200/70 mt-4 text-base leading-relaxed max-w-sm">
              Everything you need to manage tenants, track rent, and grow your paying-guest business — in one place.
            </p>
          </div>

          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-indigo-200" />
                </div>
                <p className="text-indigo-100/80 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer quote */}
        <p className="text-indigo-300/40 text-xs relative z-10">
          Trusted by PG operators across India
        </p>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-6 py-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 shadow-elevated"
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)' }}
            >
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">PG Manager</h1>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome back</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to your operations console</p>
          </div>

          <div className="card p-7 shadow-elevated">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <FormField label="Email address" error={errors.email?.message} required>
                <Input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  error={!!errors.email}
                />
              </FormField>

              <FormField
                label="Password"
                error={errors.password?.message}
                required
                hint={
                  <Link href="/forgot-password" className="text-xs text-primary-600 hover:underline font-medium">
                    Forgot password?
                  </Link>
                }
              >
                <div className="relative">
                  <Input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    error={!!errors.password}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>

              {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
                  {apiError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-2.5 text-sm"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-5">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary-600 font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
