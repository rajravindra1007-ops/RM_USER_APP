// ============================================================
//  components/BottomNav.tsx
//  Generic bottom navigation bar for RM Games
//  Usage:
//    import BottomNav from '../components/BottomNav';
//    <BottomNav active="home" />
// ============================================================

import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// All four tabs and their config
export type NavTab = 'home' | 'wallet' | 'bid-history' | 'profile';

const TABS: {
  key: NavTab;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  route: string;
}[] = [
  { key: 'home',        label: 'Home',    icon: 'home',                    route: '/home' },
  { key: 'wallet',      label: 'Wallet',  icon: 'account-balance-wallet',  route: '/sections/wallet' },
  { key: 'bid-history', label: 'History', icon: 'history',                 route: '/sections/bid-history' },
  { key: 'profile',     label: 'Profile', icon: 'person',                  route: '/sections/profile' },
];

interface BottomNavProps {
  /** Pass the key of the currently active tab so it gets the gold highlight */
  active: NavTab;
}

export default function BottomNav({ active }: BottomNavProps) {
  const router = useRouter();

  return (
     <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#14162f' }}>

    <View style={styles.bottomNav}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return isActive ? (
          <TouchableOpacity
            key={tab.key}
            style={styles.activeTab}
            onPress={() => router.push(tab.route as any)}
          >
            <MaterialIcons name={tab.icon} size={18} color="#000" />
            <Text style={styles.activeTabText}>{tab.label}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            key={tab.key}
            style={styles.navTab}
            onPress={() => router.push(tab.route as any)}
          >
            <MaterialIcons name={tab.icon} size={20} color="#9ca3af" />
          </TouchableOpacity>
        );
      })}
    </View>
     </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#14162f',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a2d5a',
  },
  activeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#facc15',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  activeTabText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  navTab: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
