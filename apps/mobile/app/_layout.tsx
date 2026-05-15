import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

function RootGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(tenant)/');
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
