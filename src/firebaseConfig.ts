// import { initializeApp } from 'firebase/app';
// import { getAuth, connectAuthEmulator } from 'firebase/auth';
// import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
// import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
// import { Platform } from 'react-native';

// Replace with your actual project config if you have one.
// For Emulators, these values don't need to be real.

// const app = initializeApp(firebaseConfig);

// const auth = getAuth(app);
// const db = getFirestore(app);
// const functions = getFunctions(app, 'asia-south1'); // Matches our functions region

// Emulator Connection Logic
// Automatically configured for physical device access
// 10.0.2.2 is usually for Android Emulator on same machine, but physical device needs LAN IP.



// Mock exports to prevent crashes
const auth = { currentUser: null };
const db = {};
const functions = {};

export { auth, db, functions };
