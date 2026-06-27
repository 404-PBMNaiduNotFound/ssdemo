'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Settings, Home, Package, Receipt } from 'lucide-react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getVendor } from '@/lib/firestore'

export default function VendorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isRegisterPage = pathname === '/vendor/register'

  useEffect(() => {
    if (isRegisterPage) {
      setLoading(false)
      return
    }
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false)
        return
      }
      const vendor = await getVendor(user.uid)
      setApprovalStatus(vendor?.approvalStatus ?? 'pending')
      setLoading(false)
    })
    return () => unsub()
  }, [isRegisterPage])

  useEffect(() => {
    if (isRegisterPage || loading) return
    if (approvalStatus !== 'approved' && pathname !== '/vendor/dashboard') {
      router.replace('/vendor/dashboard')
    }
  }, [loading, approvalStatus, pathname, router, isRegisterPage])

  const navLink = (href: string, icon: React.ReactNode, label: string) => {
    const active = pathname === href
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 text-sm font-medium transition-colors px-3 py-1.5 rounded-lg ${
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        {icon}
        {label}
      </Link>
    )
  }

  // Registration is a standalone full-page flow — no nav chrome at all
  if (isRegisterPage) {
    return <div className="min-h-screen bg-background">{children}</div>
  }

  const isApproved = approvalStatus === 'approved'

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center justify-between">
            <Link href="/vendor/dashboard" className="text-xl font-bold text-primary">
              SevaSetu
            </Link>

            <div className="flex items-center gap-1">
              {navLink('/vendor/dashboard', <LayoutDashboard className="h-4 w-4" />, 'Dashboard')}

              {isApproved && (
                <>
                  {navLink('/vendor/items', <Package className="h-4 w-4" />, 'My Items')}
                  {navLink('/vendor/transactions', <Receipt className="h-4 w-4" />, 'Transactions')}
                  {navLink('/vendor/profile', <Settings className="h-4 w-4" />, 'Profile')}
                </>
              )}

              {navLink('/', <Home className="h-4 w-4" />, 'Home')}
            </div>
          </div>
        </div>
      </nav>

      {loading || isApproved || pathname === '/vendor/dashboard' ? children : null}
    </div>
  )
}
