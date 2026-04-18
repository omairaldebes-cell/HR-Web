import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBtB-LCH2APJrim5HTqhiVfZvwRPLnZR6g",
  authDomain: "hr-system-9542b.firebaseapp.com",
  projectId: "hr-system-9542b",
  storageBucket: "hr-system-9542b.firebasestorage.app",
  messagingSenderId: "623647081770",
  appId: "1:623647081770:web:0be12f075c71c35df20a53",
  measurementId: "G-WBGQQJYCES"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Secondary App for creating new users behind the scenes without changing the current session
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);
