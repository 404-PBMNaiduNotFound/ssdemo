// lib/auth.ts
import { auth, db } from "./firebase"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth"
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore"
import type { UserRole } from "./firestore"
import { sanitizeData } from "./sanitize"

/**
 * Register a new user.
 * Creates /users/{uid} always.
 * If role === "organization", also creates /organizations/{uid}.
 */
export async function registerUser(
  email: string,
  password: string,
  role: UserRole,
  name: string
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  const uid = cred.user.uid

  await setDoc(
    doc(db, "users", uid),
    sanitizeData({
      uid,
      email,
      name,
      role,
      createdAt: serverTimestamp(),
    })
  )

  if (role === "organization") {
    await setDoc(
      doc(db, "organizations", uid),
      sanitizeData({
        uid,
        organizationName: name,
        email,
        phone: "",
        address: "",
        description: "",
        category: "",
        city: "",
        state: "",
        status: "pending",
        createdAt: serverTimestamp(),
      })
    )
  }

  if (role === "vendor") {
    await setDoc(
      doc(db, "vendors", uid),
      sanitizeData({
        uid,
        businessName: name,
        ownerName: name,
        email,
        phone: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        businessLicense: "",
        taxId: "",
        bankAccountHolder: "",
        bankAccountNumber: "",
        bankName: "",
        approvalStatus: "pending",
        createdAt: serverTimestamp(),
      })
    )
  }

  return cred.user
}

export async function loginUser(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function logoutUser() {
  // Clear the role cookie so middleware stops allowing access to protected routes
  if (typeof document !== "undefined") {
    document.cookie = "user_role=;path=/;max-age=0;SameSite=Strict"
  }
  return signOut(auth)
}

export async function getUserRole(uid: string): Promise<UserRole | null> {
  const snap = await getDoc(doc(db, "users", uid))
  return snap.exists() ? (snap.data().role as UserRole) : null
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

export function getRedirectPath(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin/dashboard"
    case "organization":
      return "/org/dashboard"
    case "vendor":
      return "/vendor/dashboard"
    case "donor":
    default:
      return "/donor/dashboard"
  }
}
