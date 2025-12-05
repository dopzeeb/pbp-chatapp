import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, Button, FlatList, StyleSheet, KeyboardAvoidingView, 
  Platform, TouchableOpacity, Image, Alert
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import {
  messagesCollection, db, storage
} from '../utils/firebase';
import {
  addDoc, serverTimestamp, query, orderBy, onSnapshot, DocumentData
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signOut, auth } from "../utils/firebase";
import NetInfo from '@react-native-community/netinfo';

type MessageType = {
  id: string;
  text?: string;
  user?: string;
  imageUrl?: string;
  createdAt?: any;
  pending?: boolean; // Flag untuk pesan yang belum terkirim
};

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

const CACHE_KEY = 'chat_history';
const PENDING_MESSAGES_KEY = 'pending_messages';

export default function ChatScreen({ route }: Props) {
  const rawName = route.params?.name || auth.currentUser?.email || 'Anonymous';
  const name = rawName.includes('@') ? rawName.split('@')[0] : rawName;
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Load cached messages immediately
    loadCachedMessages();

    // Monitor network status
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const offline = !state.isConnected;
      setIsOffline(offline);
      
      // Jika kembali online, kirim pending messages
      if (!offline) {
        sendPendingMessages();
      }
    });

    // Subscribe to Firestore
    const q = query(messagesCollection as any, orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, 
      (snapshot) => {
        const list: MessageType[] = [];
        snapshot.forEach((doc) => {
          list.push({
            id: doc.id,
            ...(doc.data() as DocumentData),
          });
        });
        setMessages(list);
        // Save to cache
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list)).catch(console.error);
      }, 
      (err) => {
        console.error('Firestore snapshot error:', err);
        // Jika error (offline), gunakan cache
        loadCachedMessages();
      }
    );

    unsubRef.current = unsub;
    return () => {
      unsub();
      unsubscribeNetInfo();
    };
  }, []);

  const loadCachedMessages = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setMessages(JSON.parse(cached));
      }
    } catch (e) {
      console.error('Error loading cached messages:', e);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    const newMessage = {
      text: message.trim(),
      user: name,
      createdAt: new Date().toISOString(), // Temporary timestamp
      pending: isOffline
    };

    try {
      if (isOffline) {
        // Simpan ke pending queue
        await savePendingMessage(newMessage);
        // Tambahkan ke UI dengan flag pending
        setMessages(prev => [...prev, { ...newMessage, id: `temp_${Date.now()}` }]);
        Alert.alert('Offline', 'Pesan akan dikirim saat terhubung kembali');
      } else {
        // Kirim langsung
        await addDoc(messagesCollection as any, {
          text: newMessage.text,
          user: newMessage.user,
          createdAt: serverTimestamp()
        });
      }
      setMessage('');
    } catch (e) {
      console.error('Send message error:', e);
      // Jika gagal, simpan ke pending
      await savePendingMessage(newMessage);
      Alert.alert('Error', 'Gagal mengirim pesan, akan dicoba lagi nanti');
    }
  };

  const savePendingMessage = async (msg: any) => {
    try {
      const existing = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
      const pending = existing ? JSON.parse(existing) : [];
      pending.push(msg);
      await AsyncStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(pending));
    } catch (e) {
      console.error('Error saving pending message:', e);
    }
  };

  const sendPendingMessages = async () => {
    try {
      const pendingJson = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
      if (!pendingJson) return;

      const pending = JSON.parse(pendingJson);
      if (pending.length === 0) return;

      // Kirim semua pending messages
      for (const msg of pending) {
        try {
          await addDoc(messagesCollection as any, {
            text: msg.text,
            user: msg.user,
            createdAt: serverTimestamp()
          });
        } catch (e) {
          console.error('Error sending pending message:', e);
        }
      }

      // Clear pending messages
      await AsyncStorage.removeItem(PENDING_MESSAGES_KEY);
      Alert.alert('✓', 'Pesan yang tertunda berhasil dikirim');
    } catch (e) {
      console.error('Error sending pending messages:', e);
    }
  };

  const pickImageAndSend = async () => {
    if (isOffline) {
      Alert.alert('Offline', 'Tidak bisa mengirim gambar saat offline');
      return;
    }

    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.7 });
    if (res.didCancel || !res.assets || res.assets.length === 0) return;
    const asset = res.assets[0];
    if (!asset.uri) return;

    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const filename = `images/${Date.now()}_${asset.fileName || 'img'}`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      await addDoc(messagesCollection as any, {
        imageUrl: url,
        user: name,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Upload error:', e);
      Alert.alert('Error', 'Gagal mengirim gambar');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Clear cache jika perlu
      // await AsyncStorage.removeItem(CACHE_KEY);
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const renderItem = ({ item }: { item: MessageType }) => {
    const mine = item.user === name;
    return (
      <View style={[styles.msgBox, mine ? styles.myMsg : styles.otherMsg]}>
        <Text style={styles.sender}>
          {item.user} {item.pending && '⏱️'}
        </Text>
        {item.text ? <Text>{item.text}</Text> : null}
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      {/* Offline indicator */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>🔌 Mode Offline</Text>
        </View>
      )}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 10 }}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ketik pesan..."
          value={message}
          onChangeText={setMessage}
        />
        <Button title="Kirim" onPress={sendMessage} />
        <TouchableOpacity onPress={pickImageAndSend} style={styles.imageBtn}>
          <Text>📷</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 10, borderTopWidth: 1, borderColor: '#ccc' }}>
        <Button title="Logout" onPress={handleLogout} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  msgBox: {
    padding: 10,
    marginVertical: 6,
    borderRadius: 6,
    maxWidth: '80%'
  },
  myMsg: {
    backgroundColor: '#d1f0ff',
    alignSelf: 'flex-end'
  },
  otherMsg: {
    backgroundColor: '#eee',
    alignSelf: 'flex-start'
  },
  sender: {
    fontWeight: 'bold',
    marginBottom: 4,
    fontSize: 12
  },
  inputRow: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    borderWidth: 1,
    marginRight: 10,
    padding: 8,
    borderRadius: 6
  },
  imageBtn: {
    marginLeft: 8,
    padding: 8
  },
  image: {
    width: 200,
    height: 120,
    marginTop: 8,
    borderRadius: 6
  },
  offlineBanner: {
    backgroundColor: '#ff9800',
    padding: 8,
    alignItems: 'center'
  },
  offlineText: {
    color: 'white',
    fontWeight: 'bold'
  }
});