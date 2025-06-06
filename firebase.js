// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged 
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
    // FieldValue is NOT imported or re-exported from here.
    // It should be imported directly in script.js where it's used.
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// IMPORTANT: For local VS Code development, hardcode your Firebase config here.
// When running in the Canvas environment, the Canvas will provide __firebase_config automatically.
const firebaseConfig = {
  apiKey: "AIzaSyC2o9IuXKBuYsbf_tSWdAPRhZMyvOwG4rc",
  authDomain: "hapak-lappid.firebaseapp.com",
  projectId: "hapak-lappid",
  storageBucket: "hapak-lappid.firebasestorage.app",
  messagingSenderId: "518813876504",
  appId: "1:518813876504:web:eff4b8547f4c3094549e6d"
};

// For local VS Code development, provide fallback/dummy values for Canvas-specific globals
// In Canvas, __app_id is injected, but locally we use a dummy string.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-vs-code-app-id'; 
// In Canvas, __initial_auth_token is injected for custom auth.
// Locally, we'll let signInAnonymously handle auth if no token is present.
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 

let app;
let db;
let auth;

// Initialize Firebase App and services
if (firebaseConfig.apiKey && firebaseConfig.projectId) { // Basic check for valid config
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log('Firebase initialized successfully from firebase.js');
    } catch (e) {
        console.error('Failed to initialize Firebase from firebase.js:', e);
        // You might want to display an error to the user via a global error message div
    }
} else {
    // This warning is important if firebaseConfig is not properly set
    console.warn('Firebase config missing or incomplete in firebase.js. Firebase functionality will be limited.');
}

// Export necessary Firebase modules and functions
export {
    app,
    db,
    auth,
    appId, // Export appId for use in constructing collection paths
    initialAuthToken, // Export initialAuthToken for auth logic
    
    // Auth functions
    onAuthStateChanged,
    signInAnonymously,
    signInWithCustomToken,

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
    orderBy, // Note: orderBy can cause errors if indices aren't configured in Firestore
    getDocs,
    // FieldValue is explicitly NOT exported from here.
};
