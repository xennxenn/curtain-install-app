import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const defaultFirebaseConfig = {
  apiKey: "AIzaSyCRM9SXoU2IWM0olulbyfAF2oeeGyJsygY",
  authDomain: "curtain-app-3d38a.firebaseapp.com",
  projectId: "curtain-app-3d38a",
  storageBucket: "curtain-app-3d38a.firebasestorage.app",
  messagingSenderId: "58897117944",
  appId: "1:58897117944:web:3b7aa0417af8bc99a4010d"
};

// Initialize Firebase with permanent app domain config
export const app = initializeApp(defaultFirebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = "curtain-app-3d38a";
