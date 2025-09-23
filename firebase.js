
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, setLogLevel, query, where, orderBy, limit, startAfter, serverTimestamp,
  doc, getDoc, updateDoc, onSnapshot, collection, addDoc, getDocs,
  enableNetwork, disableNetwork
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const FB = { doc, getDoc, updateDoc, onSnapshot, collection, addDoc, getDocs, query, where, orderBy, limit, startAfter, serverTimestamp, onAuthStateChanged };

const firebaseConfig = {
  apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
  authDomain: "travel-416ff.firebaseapp.com",
  projectId: "travel-416ff",
  storageBucket: "travel-416ff.appspot.com",
  messagingSenderId: "1075073511694",
  appId: "1:1075073511694:web:7876f492d18a702b09e75f",
};

export const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false
});

setLogLevel('error');

export const auth = getAuth(app);
export const GoogleProvider = new GoogleAuthProvider();
export const onAuth = onAuthStateChanged;
export const signIn = () => signInWithPopup(auth, GoogleProvider);
export const signOutUser = () => signOut(auth);

window.addEventListener('offline', () => disableNetwork(db).catch(()=>{}));
window.addEventListener('online',  () => enableNetwork(db).catch(()=>{}));
