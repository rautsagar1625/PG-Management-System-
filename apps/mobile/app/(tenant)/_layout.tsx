import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  name: IoniconsName;
  outlineName: IoniconsName;
  focused: boolean;
  color: string;
  size: number;
}

function TabIcon({ name, outlineName, focused, color, size }: TabIconProps) {
  return (
    <Ionicons
      name={focused ? name : outlineName}
      size={size}
      color={color}
    />
  );
}

export default function TenantLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#4f46e5' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e7eb',
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
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon
              name="home"
              outlineName="home-outline"
              focused={focused}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon
              name="wallet"
              outlineName="wallet-outline"
              focused={focused}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: 'Complaints',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon
              name="chatbubble-ellipses"
              outlineName="chatbubble-ellipses-outline"
              focused={focused}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="food-menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="restaurant" outlineName="restaurant-outline" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="location" outlineName="location-outline" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon
              name="person-circle"
              outlineName="person-circle-outline"
              focused={focused}
              color={color}
              size={size}
            />
          ),
        }}
      />
      {/* Hidden screen — navigable via router.push from Home bell icon */}
      <Tabs.Screen name="notifications" options={{ href: null, title: 'Notifications' }} />
    </Tabs>
  );
}
