import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  doc, setDoc, getDoc,
  collection, getDocs, deleteDoc
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            "AIzaSyAFu1VyNV_UTPm5Hkb6neI2rJkdSOwovGM",
  authDomain:        "classroom-seats-5c20a.firebaseapp.com",
  projectId:         "classroom-seats-5c20a",
  storageBucket:     "classroom-seats-5c20a.firebasestorage.app",
  messagingSenderId: "599613681446",
  appId:             "1:599613681446:web:f84f546c59ef3b08959be7",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// ── Helpers ──────────────────────────────────────────────────────────────────
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
