"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, Users, Building2, MailCheck, Trash2, Loader2, Search, AlertTriangle, X, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { InviteManager } from "@/components/admin/invite-manager"
import { OrgApprovals } from "@/components/admin/org-approvals"
import { VendorApprovals } from "@/components/admin/vendor-approvals"
import { Spinner } from "@/components/ui/spinner"
import {
  getUser,
  deleteDonorAccount,
  deleteOrganizationAccount,
  type UserDoc,
  type OrganizationDoc,
} from "@/lib/firestore"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"

// ── User Management Section ───────────────────────────────────────────────────

type UserEntry = {
  uid: string
  name: string
  email: string
  role: "donor" | "organization"
  phone?: string
}

function ConfirmDeleteModal({
  user,
  onConfirm,
  onCancel,
  deleting,
}: {
  user: UserEntry
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !deleting) onCancel() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base">Delete account permanently?</h3>
            <p className="mt-1 text-sm text-gray-500">
              This will delete <span className="font-medium text-gray-800">{user.name}</span> ({user.email}) and all their data — donations, notifications, and linked records. This cannot be undone.
            </p>
          </div>
          {!deleting && (
            <button onClick={onCancel} className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? "Deleting…" : "Yes, delete permanently"}
          </button>
          <button
            onClick={onCancel}
            disabled={deleting}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function UserManagement() {
  const [users, setUsers] = useState<UserEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "donor" | "organization">("all")
  const [toDelete, setToDelete] = useState<UserEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletedId, setDeletedId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch donors and orgs separately (no composite index needed)
      const [donorSnap, orgSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "donor"))),
        getDocs(query(collection(db, "users"), where("role", "==", "organization"))),
      ])
      const all: UserEntry[] = [
        ...donorSnap.docs.map((d) => {
          const data = d.data() as UserDoc
          return { uid: d.id, name: data.name ?? "—", email: data.email ?? "—", role: "donor" as const, phone: data.phone }
        }),
        ...orgSnap.docs.map((d) => {
          const data = d.data() as UserDoc
          return { uid: d.id, name: data.name ?? "—", email: data.email ?? "—", role: "organization" as const, phone: data.phone }
        }),
      ]
      setUsers(all.sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      if (toDelete.role === "donor") {
        await deleteDonorAccount(toDelete.uid)
      } else {
        await deleteOrganizationAccount(toDelete.uid)
      }
      setDeletedId(toDelete.uid)
      setUsers((prev) => prev.filter((u) => u.uid !== toDelete.uid))
      setTimeout(() => setDeletedId(null), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  const filtered = users.filter((u) => {
    const matchRole = roleFilter === "all" || u.role === roleFilter
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  const donorCount = users.filter((u) => u.role === "donor").length
  const orgCount = users.filter((u) => u.role === "organization").length

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-5">
        <h2 className="text-lg font-bold text-gray-900">User Management</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Remove donors or organizations and wipe all their data permanently.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700">{donorCount} donors</span>
          <span className="rounded-full bg-purple-50 px-2.5 py-1 font-medium text-purple-700">{orgCount} organizations</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          {(["all", "donor", "organization"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors capitalize ${
                roleFilter === r
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {r === "all" ? "All" : r === "organization" ? "Orgs" : "Donors"}
            </button>
          ))}
        </div>
      </div>

      {/* Success toast */}
      {deletedId && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Account and all associated data deleted successfully.
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-gray-100">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">
            {search || roleFilter !== "all" ? "No users match your search." : "No users found."}
          </p>
        ) : (
          filtered.map((u) => (
            <div key={u.uid} className="flex items-center gap-4 px-6 py-4">
              {/* Avatar */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
                u.role === "donor" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
              }`}>
                {u.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{u.name}</p>
                <p className="truncate text-xs text-gray-400">{u.email}</p>
                {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
              </div>

              {/* Role badge */}
              <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline-block ${
                u.role === "donor"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-purple-50 text-purple-700"
              }`}>
                {u.role === "organization" ? "Org" : "Donor"}
              </span>

              {/* Delete button */}
              <button
                onClick={() => setToDelete(u)}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-500 transition-colors hover:bg-red-50 hover:border-red-200"
                title="Delete account"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {toDelete && (
        <ConfirmDeleteModal
          user={toDelete}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
          deleting={deleting}
        />
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { user, userDoc, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || userDoc?.role !== "admin")) {
      router.replace("/login")
    }
  }, [loading, user, userDoc, router])

  if (loading || !userDoc) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (userDoc.role !== "admin") return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-xs text-gray-500">{userDoc.email}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">

        {/* Quick stat cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: MailCheck,  label: "Invite System",    value: "Active",      color: "text-blue-700",   bg: "bg-blue-50"   },
            { icon: Building2,  label: "Org Registration", value: "Invite Only", color: "text-green-700",  bg: "bg-green-50"  },
            { icon: Users,      label: "Access Control",   value: "Enabled",     color: "text-purple-700", bg: "bg-purple-50" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color}`}>
                <Icon className="h-5 w-5" />
              </span>
              <p className={`mt-3 text-xl font-bold ${color}`}>{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          ))}
        </section>

        {/* Organization approvals */}
        <OrgApprovals />

        {/* Vendor approvals */}
        <VendorApprovals />

        {/* Invite manager */}
        <InviteManager />

        {/* User management */}
        <UserManagement />

      </main>
    </div>
  )
}