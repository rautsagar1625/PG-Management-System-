import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  outlineName,
  focused,
  color,
  size,
}: {
  name: IoniconsName;
  outlineName: IoniconsName;
  focused: boolean;
  color: string;
  size: number;
}) {
  return <Ionicons name={focused ? name : outlineName} size={size} color={color} />;
}

export default function OperatorLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: colors.gray200,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 4,
          height: 62,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: (props) => (
            <TabIcon name="grid" outlineName="grid-outline" {...props} />
          ),
        }}
      />
      <Tabs.Screen
        name="tenants"
        options={{
          title: 'Tenants',
          tabBarIcon: (props) => (
            <TabIcon name="people" outlineName="people-outline" {...props} />
          ),
        }}
      />
      <Tabs.Screen
        name="collections"
        options={{
          title: 'Collections',
          tabBarIcon: (props) => (
            <TabIcon name="card" outlineName="card-outline" {...props} />
          ),
        }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: 'Complaints',
          tabBarIcon: (props) => (
            <TabIcon
              name="chatbubble-ellipses"
              outlineName="chatbubble-ellipses-outline"
              {...props}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Leads',
          tabBarIcon: (props) => (
            <TabIcon name="funnel" outlineName="funnel-outline" {...props} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: (props) => (
            <TabIcon name="person-circle" outlineName="person-circle-outline" {...props} />
          ),
        }}
      />
      {/* Hidden screens — navigable via router.push but not shown in tab bar */}
      <Tabs.Screen name="rooms" options={{ href: null, title: 'Rooms' }} />
      <Tabs.Screen name="settlements" options={{ href: null, title: 'Settlements' }} />
      <Tabs.Screen name="attendance-log" options={{ href: null, title: 'Attendance Log' }} />
      <Tabs.Screen name="food-menu" options={{ href: null, title: 'Food Menu' }} />
    </Tabs>
  );
}
