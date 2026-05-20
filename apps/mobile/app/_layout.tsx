import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

const OPERATOR_ROLES = new Set(['SUPER_ADMIN', 'OWNER', 'OPERATOR', 'CO_OPERATOR', 'STAFF']);

function RootGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }

    if (user && inAuth) {
      const dest = OPERATOR_ROLES.has(user.role) ? '/(operator)/' : '/(tenant)/';
      // expo-router typed routes are generated at runtime; cast required for new route groups
      router.replace(dest as never);
    }
  }, [user, isLoading, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootGuard />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
