import * as Notifications from 'expo-notifications';
import { Stack } from "expo-router";
import { useEffect } from 'react';
import "../firebaseConfig";
import UpdateManager from './UpdateManager';

// Ensure expo-notifications shows visible alerts even in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // Newer expo-notifications typings expect these fields as well
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    // Some devices may throw when dev keep-awake auto-activates; disable defensively
    try {
      const KeepAwake = require('expo-keep-awake');
      if (KeepAwake?.deactivateKeepAwake) {
        KeepAwake.deactivateKeepAwake();
      } else if (KeepAwake?.deactivateKeepAwakeAsync) {
        KeepAwake.deactivateKeepAwakeAsync().catch(() => {});
      }
    } catch {}
  }, []);
  return (
    <>
      <UpdateManager />
      <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* <Stack.Screen name="login" options={{ headerShown: false  }} /> */}
      <Stack.Screen name="register" options={{ headerShown: false  }} />
      <Stack.Screen name="forgot-password" options={{ title: "Forgot Password kk",headerShown:false }} />
            <Stack.Screen name="contact" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen
        name="sections/message"
        options={{
          title: 'helper',
          headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
        }}
      />
      <Stack.Screen name="sections/add-money" options={{ title: 'Add Money',headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left',   }} />
      <Stack.Screen name="sections/withdraw-money" options={{ title: 'Withdraw Money',headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left',  }} />
          <Stack.Screen name="sections/share-app" options={{ title: 'Share App',headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left',  }} />
      <Stack.Screen name="sections/chart" options={{ title: 'Chart',
          headerBackVisible: false, }} />
      <Stack.Screen name="sections/games" options={{ title: 'Games' }} />
      <Stack.Screen name="sections/games/[id]" options={{ title: 'Game',headerBackVisible: false,headerTitleStyle:{fontSize:18, fontWeight: '700'} }} />

      <Stack.Screen name="sections/games/[id]/single-digit" options={{ title: 'Single Digit',headerBackVisible: false,headerTitleStyle:{fontSize:18, fontWeight: '700',color:'#fff'},          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }, }} />
      <Stack.Screen name="sections/games/[id]/jodi-digits" options={{ title: 'Jodi Digits',headerBackVisible: false,headerTitleStyle:{fontSize:18, fontWeight: '700',color:'#fff'},          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }, }} />
      <Stack.Screen name="sections/games/[id]/single-pana" options={{ title: 'Single Pana',headerBackVisible: false,headerTitleStyle:{fontSize:18, fontWeight: '700',color:'#fff'},          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }, }} />
      <Stack.Screen name="sections/games/[id]/double-pana" options={{ title: 'Double Pana',headerBackVisible: false,headerTitleStyle:{fontSize:18, fontWeight: '700',color:'#fff'},          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }, }} />
      <Stack.Screen name="sections/games/[id]/triple-pana" options={{ title: 'Triple Pana',headerBackVisible: false,headerTitleStyle:{fontSize:18, fontWeight: '700',color:'#fff'},          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }, }} />
      <Stack.Screen name="sections/games/[id]/half-sangam" options={{ title: 'Half Sangam',headerBackVisible: false,headerTitleStyle:{fontSize:18, fontWeight: '700',color:'#fff'},          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }, }} />
      <Stack.Screen name="sections/games/[id]/full-sangam" options={{ title: 'Full Sangam',headerBackVisible: false,headerTitleStyle:{fontSize:18, fontWeight: '700',color:'#fff'},          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }, }} />
      <Stack.Screen name="sections/games/[id]/sp-motor" options={{ title: 'SP Motor',headerBackVisible: false,headerTitleStyle:{fontSize:18, fontWeight: '700',color:'#fff'},          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }, }} />
      <Stack.Screen name="sections/games/[id]/dp-motor" options={{ title: 'DP Motor',headerBackVisible: false,headerTitleStyle:{fontSize:18, fontWeight: '700',color:'#fff'},          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }, }} />
      <Stack.Screen name="sections/games/[id]/sp-dp-tp" options={{ title: 'SP DP TP Motor',headerBackVisible: false,headerTitleStyle:{fontSize:18, fontWeight: '700',color:'#fff'},          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } }, }} />
      <Stack.Screen name="sections/profile" options={{
          title: 'Profile',
          headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left',
        }} />
      <Stack.Screen name="sections/bid-history" options={{
          title: 'Bid History',
          headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left',
        }} />
      <Stack.Screen name="sections/my-winning" options={{
          title: 'My Winning',
          headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left',
        }} />
      <Stack.Screen name="sections/account-statement" options={{ title: 'Account Statement',headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left', }} />
            <Stack.Screen name="sections/withdraw-requests" options={{ title: 'Account Statement',headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left', }} />
           <Stack.Screen name="sections/money-added" options={{ title: 'Account Statement',headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left', }} />
      <Stack.Screen name="sections/bank-details" options={{
          title: 'Bank Details',
          headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left',
        }} />
      <Stack.Screen name="sections/notice-board" options={{ title: 'Notice Board',headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left', }} />
      <Stack.Screen name="sections/rate-chart" options={{ title: 'Rate Chart',
          headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left', }} />
      <Stack.Screen name="sections/how-to-play" options={{ title: 'How To Play',headerBackVisible: false,
          headerStyle: { backgroundColor: '#0b1f4c', elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
          headerTitleStyle: { color: '#f4f6ff', fontWeight: '700', fontSize: 18 },
          headerTintColor: '#f4f6ff',
          headerTitleAlign: 'left', }} />
      <Stack.Screen name="sections/logout" options={{ title: 'Logout',
          headerBackVisible: false, }} />
      </Stack>
    </>
  );
}
