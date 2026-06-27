// lib/storage.ts
// Firebase Storage utility for uploading organization images

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage"
import { storage } from "./firebase"

/**
 * Compress an image file using canvas before uploading.
 * Resizes to max 800x800 and converts to JPEG at 80% quality.
 * Typical reduction: 2–5 MB → 100–200 KB.
 */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectURL = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectURL)

      const MAX_DIM = 800
      let { width, height } = img

      // Scale down if larger than MAX_DIM
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width)
          width = MAX_DIM
        } else {
          width = Math.round((width * MAX_DIM) / height)
          height = MAX_DIM
        }
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext("2d")
      if (!ctx) return reject(new Error("Canvas not supported"))

      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"))
          resolve(blob)
        },
        "image/jpeg",
        0.8 // 80% quality
      )
    }

    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = objectURL
  })
}

/**
 * Upload an organization image to Firebase Storage.
 * Compresses the image first (→ JPEG, max 800px, 80% quality) for fast uploads.
 * Returns the public download URL.
 *
 * @param orgId      - The organization's Firestore document ID
 * @param file       - The image File object from an <input type="file">
 * @param onProgress - Optional callback receiving upload % (0–100)
 */
export async function uploadOrgImage(
  orgId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  // Validate file type
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  if (!allowed.includes(file.type)) {
    throw new Error("Only JPEG, PNG, WebP or GIF images are allowed.")
  }

  // Validate file size (max 5 MB)
  const MAX_SIZE_MB = 5
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`Image must be smaller than ${MAX_SIZE_MB} MB.`)
  }

  // Compress before uploading — always store as .jpg after compression
  const compressed = await compressImage(file)

  // Build a fixed path: organizations/<orgId>/profile.jpg
  const storagePath = `organizations/${orgId}/profile.jpg`
  const storageRef = ref(storage, storagePath)

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, compressed, {
      contentType: "image/jpeg",
    })

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        )
        onProgress?.(percent)
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(url)
      }
    )
  })
}

/**
 * Delete an organization's image from Firebase Storage.
 * Safe to call even if the file doesn't exist.
 */
export async function deleteOrgImage(orgId: string): Promise<void> {
  try {
    const storageRef = ref(storage, `organizations/${orgId}/profile.jpg`)
    await deleteObject(storageRef)
  } catch {
    // File didn't exist — that's fine
  }
}

/**
 * Upload a vendor verification document (business license, tax certificate,
 * bank statement, identity) to Firebase Storage. No compression — these are
 * often PDFs, unlike uploadOrgImage which is image-only.
 * Returns the public download URL to store in the vendorDocuments Firestore doc.
 *
 * @param vendorId     - The vendor's Firebase Auth uid
 * @param documentType - One of VendorDocumentDoc["documentType"]
 * @param file         - The File object from an <input type="file">
 */
export async function uploadVendorDocumentFile(
  vendorId: string,
  documentType: string,
  file: File
): Promise<string> {
  const MAX_SIZE_MB = 10
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`File must be smaller than ${MAX_SIZE_MB} MB.`)
  }

  const safeExt = file.name.includes(".") ? file.name.split(".").pop() : "pdf"
  const storagePath = `vendors/${vendorId}/documents/${documentType}-${Date.now()}.${safeExt}`
  const storageRef = ref(storage, storagePath)

  const uploadTask = uploadBytesResumable(storageRef, file)

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      () => {},
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(url)
      }
    )
  })
}