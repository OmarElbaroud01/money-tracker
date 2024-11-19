// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdDrCDb8VJIak9nA1KEwCz01UwfmjFe4I",
  authDomain: "moneytracker-36348.firebaseapp.com",
  databaseURL: "https://moneytracker-36348-default-rtdb.firebaseio.com",
  projectId: "moneytracker-36348",
  storageBucket: "moneytracker-36348.firebasestorage.app",
  messagingSenderId: "1068959391369",
  appId: "1:1068959391369:web:f9edb6778579472f0d3058",
  measurementId: "G-VZPW8FWFX3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const db = firebase.database(); 