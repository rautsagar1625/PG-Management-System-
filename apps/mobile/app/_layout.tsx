import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { api } from '../src/lib/api';

// ─── Notification handler — show alerts even when app is in foreground ────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,  // required by newer expo-notifications versions
    shouldShowList: true,    // required by newer expo-notifications versions
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// ─── Notification data conventions sent by the backend ───────────────────────
interface NotificationData {
  type?: 'PAYMENT' | 'COMPLAINT' | 'RENT' | 'AGREEMENT' | 'SYSTEM';
  rentCycleId?: string;
  complaintId?: string;
  agreementId?: string;
  screen?: string;  // Optional override — direct route e.g. '/(tenant)/payments'
}

const OPERATOR_ROLES = new Set(['SUPER_ADMIN', 'OWNER', 'OPERATOR', 'CO_OPERATOR']);

// ─── Root guard + notification wiring ────────────────────────────────────────

function RootGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const notifListenerRef = useRef<Notifications.EventSubscription | null>(null);
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);

  // ── Auth routing ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }

    if (user && inAuth) {
      let dest: string;
      if (OPERATOR_ROLES.has(user.role)) {
        dest = '/(operator)/';
      } else if (user.role === 'STAFF') {
        dest = '/(staff)/';
      } else {
        dest = '/(tenant)/';
      }
      router.replace(dest as never);
    }
  }, [user, isLoading, segments, router]);

  // ── Deep-link router based on notification type ────────────────────────────
  const handleNotificationTap = useCallback(
    (data: NotificationData) => {
      if (!user) return; // Not logged in; ignore

      const isOperator = OPERATOR_ROLES.has(user.role);
      const isStaff = user.role === 'STAFF';

      // Explicit screen override from notification payload
      if (data.screen) {
        router.push(data.screen as never);
        return;
      }

      // Cast paths with `as never` — Expo Router's typed-routes only knows about
      // statically registered screens; deep-link paths resolved at runtime are safe
      // but not inferable at compile time.
      switch (data.type) {
        case 'RENT':
        case 'PAYMENT':
          if (isOperator) router.push('/(operator)/collections' as never);
          else if (!isStaff) router.push('/(tenant)/payments' as never);
          break;
        case 'COMPLAINT':
          if (isOperator) router.push('/(operator)/complaints' as never);
          else if (isStaff) router.push('/(staff)/complaints' as never);
          else router.push('/(tenant)/complaints' as never);
          break;
        case 'AGREEMENT':
          if (!isOperator && !isStaff) router.push('/(tenant)/agreements' as never);
          break;
        case 'SYSTEM':
          if (!isOperator && !isStaff) router.push('/(tenant)/notifications' as never);
          break;
        default:
          // No deep-link action for unknown types
          break;
      }
    },
    [user, router],
  );

  // ── Push notification registration + listeners ─────────────────────────────
  useEffect(() => {
    if (!user) return; // Only register when authenticated

    let isMounted = true;

    async function registerForPush() {
      if (!Device.isDevice) {
        // Simulator/emulator — skip registration; push won't work anyway
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4f46e5',
        });
      }

      try {
        // projectId is picked up automatically from app.json / eas.json in production builds.
        // In Expo Go, no projectId is needed.
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        if (isMounted && token) {
          // Register token with backend
          await api.post('/users/push-token', { token });
        }
      } catch {
        // Silently ignore — push is non-critical
      }
    }

    registerForPush();

    // Foreground notification listener — just show the alert (handled by setNotificationHandler)
    notifListenerRef.current = Notifications.addNotificationReceivedListener((_notification) => {
      // No additional action needed for foreground notifications
    });

    // Response listener — user tapped a notification
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = (response.notification.request.content.data ?? {}) as NotificationData;
        handleNotificationTap(data);
      },
    );

    return () => {
      isMounted = false;
      notifListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [user, handleNotificationTap]);

  // ── Handle app opened from a killed state via notification ─────────────────
  useEffect(() => {
    if (!user || isLoading) return;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = (response.notification.request.content.data ?? {}) as NotificationData;
      handleNotificationTap(data);
    });
  }, [user, isLoading, handleNotificationTap]);

  return null;
}

// ─── Root layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootGuard />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
