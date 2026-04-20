import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LiderDashboardScreen from '../screens/LiderDashboardScreen';
import UPHDashboardLiderScreen from '../screens/UPHDashboardLiderScreen';
import AsignacionLideraScreen from '../screens/AsignacionLideraScreen';
import SearchHStVtScreen from '../screens/SearchHStVtScreen';
import { useAuth } from '../contexts/AuthContext';

const Tab = createBottomTabNavigator();

const TAB_ICON = {
  Asignacion: '👥',
  Dashboard:  '📊',
  Inicio:     '🏠',
  Modelos:    '🔍',
};

function TabIcon({ name, focused }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.5 }}>
      {TAB_ICON[name]}
    </Text>
  );
}

export default function LiderTabNavigator() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarStyle: {
          backgroundColor: '#111',
          borderTopColor: '#222',
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom || 8,
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 11 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Inicio"     component={LiderDashboardScreen}    options={{ title: 'Inicio' }} />
      <Tab.Screen
        name="Asignacion"
        component={AsignacionLideraScreen}
        options={{ title: 'Asignación' }}
        listeners={() => ({
          tabPress: (e) => {
            if (!user?.linea_uph) {
              e.preventDefault();
              Alert.alert(
                'Selecciona una línea',
                'Debes configurar tu línea en Inicio antes de acceder a Asignación.',
                [{ text: 'Entendido' }]
              );
            }
          },
        })}
      />
      <Tab.Screen name="Dashboard"  component={UPHDashboardLiderScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Modelos"    component={SearchHStVtScreen}       options={{ title: 'Modelos' }} />
    </Tab.Navigator>
  );
}
