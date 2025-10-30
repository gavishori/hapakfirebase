// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    addDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    collection, 
    query, 
    where, 
    orderBy, 
    getDocs, 
    writeBatch 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2o9IuXKBuYsbf_tSWdAPRhZMyvOwG4rc",
  authDomain: "hapak-lappid.firebaseapp.com",
  projectId: "hapak-lappid",
  storageBucket: "hapak-lappid.firebasestorage.app",
  messagingSenderId: "518813876504",
  appId: "1:518813876504:web:eff4b8547f4c3094549e6d"
};

// For local VS Code development, provide fallback/dummy values for Canvas-specific globals
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-vs-code-app-id'; 
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 

let app;
let db;
let auth;

// Initialize Firebase App and services
if (firebaseConfig.apiKey && firebaseConfig.projectId) { 
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log('Firebase initialized successfully from firebase.js');
    } catch (e) {
        console.error('Failed to initialize Firebase from firebase.js:', e);
    }
} else {
    console.warn('Firebase config missing or incomplete in firebase.js. Firebase functionality will be limited.');
}

// Export necessary Firebase modules and functions
export {
    app,
    db,
    auth,
    appId, 
    initialAuthToken, 
    
    // Auth functions - these must be exported from firebase.js
    onAuthStateChanged,
    signInAnonymously,
    signInWithCustomToken,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 

    // Firestore functions
    doc,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    collection,
    query,
    where,
    orderBy, 
    getDocs,
    writeBatch, 
};
