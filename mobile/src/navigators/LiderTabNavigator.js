import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import LiderDashboardScreen from '../screens/LiderDashboardScreen';
import UPHDashboardLiderScreen from '../screens/UPHDashboardLiderScreen';
import ModeloLideraScreen from '../screens/ModeloLideraScreen';
import AsignacionLideraScreen from '../screens/AsignacionLideraScreen';
import SearchHStVtScreen from '../screens/SearchHStVtScreen';

const Tab = createBottomTabNavigator();

const TAB_ICON = {
  Inicio:      '🏠',
  Dashboard:   '📊',
  Cantidades:  '📋',
  Asignacion:  '👥',
  Modelos:     '🔍',
};

function TabIcon({ name, focused }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.5 }}>
      {TAB_ICON[name]}
    </Text>
  );
}

export default function LiderTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarStyle: {
          backgroundColor: '#111',
          borderTopColor: '#222',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 11 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Inicio"     component={LiderDashboardScreen}    options={{ title: 'Inicio' }} />
      <Tab.Screen name="Dashboard"  component={UPHDashboardLiderScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Cantidades" component={ModeloLideraScreen}      options={{ title: 'Cantidades' }} />
      <Tab.Screen name="Asignacion" component={AsignacionLideraScreen}  options={{ title: 'Asignación' }} />
      <Tab.Screen name="Modelos"    component={SearchHStVtScreen}       options={{ title: 'Modelos' }} />
    </Tab.Navigator>
  );
}
