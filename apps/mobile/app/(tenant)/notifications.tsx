import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { useAsync } from '../../src/lib/hooks';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationMeta {
  total: number;
  unread: number;
  page: number;
  limit: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  PAYMENT: 'card-outline',
  COMPLAINT: 'chatbubble-outline',
  RENT: 'receipt-outline',
  SYSTEM: 'information-circle-outline',
  ANNOUNCEMENT: 'megaphone-outline',
};

export default function NotificationsScreen() {
  const { top } = useSafeAreaInsets();
  const [localRead, setLocalRead] = useState<Set<string>>(new Set());

  const { data, loading, refetch } = useAsync(async () => {
    const res = await api.get<{
      success: boolean;
      data: NotificationItem[];
      meta: NotificationMeta;
    }>('/notifications?limit=50');
    return res;
  }, []);

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter(
    (n: NotificationItem) => !n.isRead && !localRead.has(n.id),
  ).length;

  const markRead = useCallback(async (id: string) => {
    setLocalRead((prev) => new Set([...prev, id]));
    try {
      await api.put(`/notifications/${id}/read`, {});
    } catch {
      // silent — optimistic update already applied
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications
      .filter((n: NotificationItem) => !n.isRead)
      .map((n: NotificationItem) => n.id);
    setLocalRead((prev) => new Set([...prev, ...unread]));
    try {
      await api.put('/notifications/mark-all-read', {});
      await refetch();
    } catch {
      // silent
    }
  }, [notifications, refetch]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: top + 20 }]}
      >
        <View style={styles.heroRing} />
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount} unread</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} activeOpacity={0.8}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={40} color={colors.gray300} style={{ marginBottom: 10 }} />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n: NotificationItem) => n.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading && !!data} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item: n }) => {
            const isRead = n.isRead || localRead.has(n.id);
            const icon = TYPE_ICON[n.type] ?? 'notifications-outline';
            return (
              <TouchableOpacity
                onPress={() => !isRead && markRead(n.id)}
                activeOpacity={0.85}
                style={[styles.card, !isRead && styles.cardUnread]}
              >
                {!isRead && <View style={styles.unreadIndicator} />}
                <View style={[styles.iconWrap, { backgroundColor: isRead ? colors.gray100 : colors.primaryLight }]}>
                  <Ionicons name={icon} size={18} color={isRead ? colors.gray400 : colors.primary} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, !isRead && styles.cardTitleUnread]}>{n.title}</Text>
                  <Text style={styles.cardBody2} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.cardTime}>{timeAgo(n.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  hero: { paddingHorizontal: 20, paddingBottom: 24, overflow: 'hidden' },
  heroRing: {
    position: 'absolute', right: -60, top: -60,
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 40, borderColor: 'rgba(255,255,255,0.05)',
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  unreadBadge: { marginTop: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2 },
  unreadBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  markAllBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  markAllText: { fontSize: 12, color: '#fff', fontWeight: '600' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: colors.gray400, fontWeight: '500' },

  listContent: { padding: 16, gap: 8, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  unreadIndicator: { position: 'absolute', top: 14, right: 14, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 2 },
  cardTitleUnread: { fontWeight: '800', color: colors.gray900 },
  cardBody2: { fontSize: 12, color: colors.gray500, lineHeight: 17 },
  cardTime: { fontSize: 10, color: colors.gray400, marginTop: 4 },
});
