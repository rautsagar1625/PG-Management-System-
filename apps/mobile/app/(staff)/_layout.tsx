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

/**
 * Staff layout — 4 tabs only.
 * STAFF role should not see financial data (collections, leads, settlements).
 * They handle: complaints assigned to them, daily attendance, food menu, profile.
 */
export default function StaffLayout() {
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
          title: 'My Tasks',
          tabBarIcon: (props) => (
            <TabIcon name="checkmark-circle" outlineName="checkmark-circle-outline" {...props} />
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
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: (props) => (
            <TabIcon name="location" outlineName="location-outline" {...props} />
          ),
        }}
      />
      <Tabs.Screen
        name="food-menu"
        options={{
          title: 'Food Menu',
          tabBarIcon: (props) => (
            <TabIcon name="restaurant" outlineName="restaurant-outline" {...props} />
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
    </Tabs>
  );
}
