import { initializeApp } from 'firebase/app';
import { getFirestore, collection, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  Auth
} from "firebase/auth";
import { getStorage } from 'firebase/storage';
import '@react-native-async-storage/async-storage'; 

const firebaseConfig = {
  apiKey: "AIzaSyBxEcjIBTfKfX6CPo6Axg8-AGOsGYFHcPo",
  authDomain: "chatapp-277d7.firebaseapp.com",
  projectId: "chatapp-277d7",
  storageBucket: "chatapp-277d7.firebasestorage.app",
  messagingSenderId: "502285787428",
  appId: "1:502285787428:android:28b060ccccff04e33993b1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Enable offline persistence untuk Firestore
// Catatan: Ini otomatis aktif di React Native, tapi kita bisa set explicit
// Di web perlu enableIndexedDbPersistence, tapi di RN sudah auto-enable

export const messagesCollection = collection(db, 'messages');

export {
  auth,
  db,
  storage,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
};