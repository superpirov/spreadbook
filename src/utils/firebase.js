import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Public web config (safe to commit: Firebase Auth is secured by
// Authorized domains + provider settings, not by the apiKey).
// Project: spreadbook-5452d
const firebaseConfig = {
  apiKey: 'AIzaSyBXE38uVgZBxAm0DBKBMeRSwX-yPaSzYME',
  authDomain: 'spreadbook-5452d.firebaseapp.com',
  projectId: 'spreadbook-5452d',
  storageBucket: 'spreadbook-5452d.firebasestorage.app',
  messagingSenderId: '324453519939',
  appId: '1:324453519939:web:e2082a1cb1becab2ac3af6',
  measurementId: 'G-PD53M9RXQN',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
