import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { auth, db } from '../../firebaseConfig';
import firestore from '@react-native-firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

type ChatMessage = {
  id: string;
  text?: string;
  imageUrl?: string;
  type: 'text' | 'image';
  senderId: string;
  seen?: boolean;
  createdAt?: FirebaseFirestoreTypes.Timestamp | null;
};

type ListItem =
  | { kind: 'header'; id: string; label: string }
  | ({ kind: 'message' } & ChatMessage);

// Avoid TS complaints about Timestamp type without importing full types
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace FirebaseFirestoreTypes {
  type Timestamp = any;
}

export default function MessageScreen() {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [items, setItems] = useState<ListItem[]>([]);
  const listRef = useRef<FlatList<ListItem>>(null);
  const inputRef = useRef<any>(null);

  const uid = auth.currentUser?.uid || '';
  const insets = useSafeAreaInsets();

  const cloudinaryConfig = useMemo(() => {
    const cloudName = 'dnkpda0cc';
    const uploadPreset = 'BetImages';
    return { cloudName, uploadPreset } as { cloudName?: string; uploadPreset?: string };
  }, []);

  const updateUserStats = useCallback(async () => {
    if (!uid) return;
    const userDocRef = db.collection('users').doc(uid);
    const userDataDocRef = db.collection('userData').doc(uid);
    try {
      await Promise.all([
        userDocRef.set(
          {
            pendingmessage: firestore.FieldValue.increment(1),
            lastmessagetime: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
        userDataDocRef.set(
          {
            Messagecount: firestore.FieldValue.increment(1),
          },
          { merge: true },
        ),
      ]);
    } catch (err) {
      console.warn('Failed to update user stats', err);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const ref = db.collection('users').doc(uid).collection('help_admin').orderBy('createdAt', 'asc');
    const unsub = ref.onSnapshot((snap) => {
      const list: ChatMessage[] = [];
      snap.forEach((doc) => {
        const d = doc.data() as any;
        list.push({
          id: doc.id,
          text: d.text || '',
          imageUrl: d.imageUrl || undefined,
          type: (d.type as 'text' | 'image') || (d.imageUrl ? 'image' : 'text'),
          senderId: d.senderId || '',
          seen: typeof d.seen === 'boolean' ? d.seen : undefined,
          createdAt: d.createdAt || null,
        });
      });
      setMessages(list);
      // build grouped items with day headers like WhatsApp
      const grouped: ListItem[] = [];
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
      let lastHeaderKey: string | null = null;

      for (const m of list) {
        const tsMs = (() => {
          const ca = m.createdAt;
          if (!ca) return 0;
          try {
            if (typeof ca.toDate === 'function') return ca.toDate().getTime();
            const d = new Date(ca);
            return d.getTime();
          } catch { return 0; }
        })();

        const dayKey = (() => {
          if (!tsMs) return 'Unknown';
          const d = new Date(tsMs);
          const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          if (dayStart >= startOfToday) return 'Today';
          if (dayStart >= startOfYesterday) return 'Yesterday';
          return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getFullYear()}`;
        })();

        if (dayKey !== lastHeaderKey) {
          grouped.push({ kind: 'header', id: `h_${dayKey}`, label: dayKey });
          lastHeaderKey = dayKey;
        }
        grouped.push({ kind: 'message', ...m });
      }
      setItems(grouped);
      // mark admin messages as seen=true when user has viewed snapshot
      try {
        const batch = db.batch();
        let hasUpdates = false;
        snap.forEach((doc) => {
          const d = doc.data() as any;
          const isAdminMsg = d.senderId && d.senderId !== uid;
          const notSeen = d.seen !== true;
          if (isAdminMsg && notSeen) {
            batch.update(doc.ref, { seen: true });
            hasUpdates = true;
          }
        });
        if (hasUpdates) {
          // fire-and-forget; we don't need to block UI render here
          batch.commit().catch(() => {});
        }
      } catch {}
    });
    return () => unsub();
  }, [uid]);

  // Focus the input on first mount so keyboard opens and cursor is active
  useEffect(() => {
    // small delay to ensure layout completed across platforms
    const id = setTimeout(() => {
      try { inputRef.current?.focus(); } catch {}
    }, 220);
    return () => clearTimeout(id);
  }, []);

  const sendText = useCallback(async () => {
    if (!uid) {
      Alert.alert('Not signed in');
      return;
    }
    const text = input.trim();
    if (!text) return;
    setSending(true);
    try {
      await db.collection('users').doc(uid).collection('help_admin').add({
        text,
        type: 'text',
        senderId: uid,
        seen: true,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      await updateUserStats();
      setInput('');
    } catch (e: any) {
      Alert.alert('Send failed', e?.message || String(e));
    } finally {
      setSending(false);
    }
  }, [input, uid, updateUserStats]);

  const pickAndUploadImage = useCallback(async () => {
    if (!uid) {
      Alert.alert('Not signed in');
      return;
    }
    const { cloudName, uploadPreset } = cloudinaryConfig;
    if (!cloudName || !uploadPreset) {
      Alert.alert('Cloudinary not configured', 'Please set Cloudinary cloud name and unsigned upload preset in app.json extra or EXPO_PUBLIC_ envs.');
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'We need photo library permission to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets || !result.assets.length) return;
    const asset = result.assets[0];

    setUploading(true);
    try {
      const base64 = asset.base64;
      let fileData: any;
      if (base64) {
        fileData = `data:${asset.mimeType || 'image/jpeg'};base64,${base64}`;
      } else {
        // fallback to uri upload via multipart
        fileData = { uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: 'image.jpg' } as any;
      }

      const form = new FormData();
      form.append('file', fileData as any);
      form.append('upload_preset', uploadPreset);

      const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: form as any,
      });

      if (!resp.ok) throw new Error(`Cloudinary upload failed: ${resp.status}`);
      const data = await resp.json();
      const url = data.secure_url || data.url;
      if (!url) throw new Error('No URL returned from Cloudinary');

      await db.collection('users').doc(uid).collection('help_admin').add({
        imageUrl: url,
        type: 'image',
        senderId: uid,
        seen: true,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      await updateUserStats();
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || String(e));
    } finally {
      setUploading(false);
    }
  }, [uid, cloudinaryConfig, updateUserStats]);

  const fmtTime = (ms: number) => {
    const d = new Date(ms);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'header') {
      return (
        <View style={styles.headerWrap}>
          <View style={styles.headerPill}><Text style={styles.headerText}>{item.label}</Text></View>
        </View>
      );
    }
    const isMe = item.senderId === uid;
    const ms = (() => {
      const ca = item.createdAt;
      if (!ca) return Date.now();
      try { if (typeof ca.toDate === 'function') return ca.toDate().getTime(); return new Date(ca).getTime(); } catch { return Date.now(); }
    })();
    return (
      <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {item.type === 'image' && item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
          ) : (
            <Text style={[styles.text, isMe ? styles.textMe : styles.textOther]}>{item.text}</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={[styles.time, isMe ? styles.timeMe : styles.timeOther]}>{fmtTime(ms)}</Text>
            {isMe && (
              <Text style={[styles.tick, item.seen ? styles.tickSeen : styles.tickUnseen]}>
                {item.seen ? '✔✔' : '✔'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }, [uid]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f8fb' }} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(it) => it.kind === 'header' ? it.id : it.id}
            renderItem={renderItem}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, paddingBottom: 80 + insets.bottom, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            ListFooterComponent={<View style={{ height: 12 }} />}
          />

          <View style={[styles.inputBar, { paddingBottom: 58 + insets.bottom }]}>
            <TouchableOpacity style={styles.iconBtn} onPress={pickAndUploadImage} disabled={uploading}>
              {uploading ? <ActivityIndicator size="small" color="#111827" /> : <Text style={styles.iconText}>＋</Text>}
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Type a message"
              value={input}
              onChangeText={setInput}
              multiline
              onFocus={() => {
                // ensure the list moves up with keyboard and shows latest messages
                requestAnimationFrame(() => {
                  try { listRef.current?.scrollToEnd({ animated: true }); } catch {}
                });
              }}
            />
            <TouchableOpacity style={[styles.sendBtn, (sending || !input.trim()) && styles.sendBtnDisabled]} onPress={sendText} disabled={sending || !input.trim()}>
              {sending ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.sendText}>Send</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerWrap: { alignItems: 'center', marginVertical: 8 },
  headerPill: { backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  headerText: { color: '#111827', fontWeight: '600' },
  row: { width: '100%', marginVertical: 6, flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  bubbleMe: { backgroundColor: '#2563eb' },
  bubbleOther: { backgroundColor: '#e5e7eb' },
  text: { fontSize: 15 },
  textMe: { color: '#ffffff' },
  textOther: { color: '#111827' },
  time: { fontSize: 11, marginTop: 4, alignSelf: 'flex-end', opacity: 0.9 },
  timeMe: { color: '#ffffff' },
  timeOther: { color: '#374151' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tick: { fontSize: 11, marginLeft: 6 },
  tickUnseen: { color: '#d1d5db' },
  tickSeen: { color: '#93c5fd' },
  image: { width: 220, height: 220, borderRadius: 10 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 0,
    marginBottom: 6,
    backgroundColor: '#ffffff',
    borderTopColor: '#e5e7eb',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  iconText: { fontSize: 20, color: '#111827' },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderColor: '#e5e7eb',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fafafa',
    color: '#111827',
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#ffffff', fontWeight: '600' },
});
