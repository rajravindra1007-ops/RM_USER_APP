import { Platform } from 'react-native'
import authModule from '@react-native-firebase/auth'
import firestoreModule from '@react-native-firebase/firestore'

// Provided config (used for web fallback if ever needed)
export const firebaseWebConfig = {
//  apiKey: "AIzaSyAa8C1vuuveqcB0og_shDSKyxGn8n5Y4Ak",
//   authDomain: "demoapp-7998a.firebaseapp.com",
//   projectId: "demoapp-7998a",
//   storageBucket: "demoapp-7998a.firebasestorage.app",
//   messagingSenderId: "1061707635145",
//   appId: "1:1061707635145:web:d47501d880b34a44847018",
//   measurementId: "G-L7TRGZT9C9"
  apiKey: "AIzaSyBTZ7PM_FygrNGnt4D0U8SVud3ZcOUkYr0",
  authDomain: "rmapp-7ab9e.firebaseapp.com",
  projectId: "rmapp-7ab9e",
  storageBucket: "rmapp-7ab9e.firebasestorage.app",
  messagingSenderId: "1061531520387",
  appId: "1:1061531520387:web:9fc9dc3c42743423adbab6",
  measurementId: "G-6SDJ0JE3C8"
}

// Initialize RNFirebase (native platforms handle config via google-services files)
// Export auth & firestore from RNFirebase
export const auth = authModule()
export const db = firestoreModule()

// Access static providers (EmailAuthProvider) from the module, not the instance
export const authProviders = authModule

// Helper to build derived email from phone
export const phoneToEmail = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@userapp.com`
}
