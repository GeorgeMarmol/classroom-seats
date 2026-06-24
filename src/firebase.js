import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  doc, setDoc, getDoc,
  collection, getDocs, deleteDoc
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

export async function fsSet(pathStr, data) {
  const parts = pathStr.split('/')
  await setDoc(doc(db, ...parts), data, { merge: true })
}

export async function fsGet(pathStr) {
  const parts = pathStr.split('/')
  const snap  = await getDoc(doc(db, ...parts))
  return snap.exists() ? snap.data() : null
}

export async function fsList(colPath) {
  const snap = await getDocs(collection(db, colPath))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function fsDel(pathStr) {
  const parts = pathStr.split('/')
  await deleteDoc(doc(db, ...parts))
}