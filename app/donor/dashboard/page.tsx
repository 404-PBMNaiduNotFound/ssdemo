"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  HandHeart, CheckCircle2, Building2, Sparkles, ArrowRight,
  MapPin, Package, Calendar, ChevronRight, IndianRupee,
} from "lucide-react"
import { StatusBadge } from "@/components/donor/status-badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import {
  getDonorDonations,
  getDonorOrders,
  getOrganizations,
  getRequirements,
  getSlots,
  type DonationDoc,
  type OrderDoc,
  type OrganizationDoc,
  type RequirementDoc,
  type SlotDoc,
} from "@/lib/firestore"
import { Spinner } from "@/components/ui/spinner"
import { CompleteProfilePopup } from "@/components/donor/complete-profile-popup"

function getContribution(d: DonationDoc) {
  if (d.itemName) return `${d.itemName} — ${d.quantity ?? 0} ${d.unit ?? ""}`
  if (d.quantity)  return `${d.quantity} ${d.unit ?? ""}`.trim()
  if (d.meals)     return `${d.meals} meals`
  return "Meal Sponsorship"
}

function getDisplayDate(d: DonationDoc): string {
  if (d.donationDate) {
    const dt = new Date(d.donationDate)
    if (!isNaN(dt.getTime())) return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  }
  const ts = d.createdAt as any
  if (!ts) return "—"
  const date = typeof ts.toDate === "function" ? ts.toDate() : typeof ts.seconds === "number" ? new Date(ts.seconds * 1000) : null
  if (!date || isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function tsToDate(ts: any): Date | null {
  if (!ts) return null
  if (typeof ts.toDate === "function") return ts.toDate()
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000)
  return null
}

type RecommendedItem =
  | { type: "requirement"; req: RequirementDoc; org: OrganizationDoc }
  | { type: "slot"; slot: SlotDoc; org: OrganizationDoc }

export default function DashboardPage() {
  const { user, userDoc } = useAuth()
  const [donations, setDonations]         = useState<DonationDoc[]>([])
  const [orders, setOrders]               = useState<OrderDoc[]>([])
  const [organizations, setOrganizations] = useState<OrganizationDoc[]>([])
  const [requirements, setRequirements]   = useState<RequirementDoc[]>([])
  const [slots, setSlots]                 = useState<SlotDoc[]>([])
  const [loading, setLoading]             = useState(true)
  const [orgFilter, setOrgFilter]         = useState<string>("All")

  useEffect(() => {
    if (!user?.uid) return
    async function load() {
      setLoading(true)
      try {
        const [donationsData, orgsData, reqsData, slotsData, ordersData] = await Promise.all([
          getDonorDonations(user!.uid),
          getOrganizations(),
          getRequirements(),
          getSlots(),
          getDonorOrders(user!.uid),
        ])
        setDonations(donationsData)
        setOrganizations(orgsData)
        setRequirements(reqsData)
        setSlots(slotsData)
        setOrders(ordersData)
      } catch (e) {
        console.error("Dashboard load failed:", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.uid])

  const orgMap = useMemo(() => {
    const m = new Map<string, OrganizationDoc>()
    organizations.forEach(o => m.set(o.uid || o.orgId || "", o))
    return m
  }, [organizations])

  // Only completed donations
  const completedDonations = useMemo(
    () => donations.filter(d => d.status === "Completed"),
    [donations]
  )

  // Map donationId -> order, so each donation can be matched to the vendor
  // order (if any) that carries its real item cost — same as the Impact page.
  const orderByDonationId = useMemo(() => {
    const map: Record<string, OrderDoc> = {}
    orders.forEach((o) => { if (o.donationId) map[o.donationId] = o })
    return map
  }, [orders])

  // Total amount donated across every donation type (meals, items, own-items, etc.) —
  // Completed only. Most donations carry their paid amount directly on donations.amount
  // (e.g. requirement checkout). Donations fulfilled via the "find vendor" flow record
  // their cost on the matching orders.amount instead (donations.amount is 0 in that case)
  // — so fall back to the linked order's amount whenever the donation itself has none.
  const totalAmountDonated = useMemo(() => {
    return completedDonations.reduce((s, d) => {
      const donationAmount = d.amount ?? 0
      const orderAmount = d.id ? orderByDonationId[d.id]?.amount ?? 0 : 0
      return s + (donationAmount > 0 ? donationAmount : orderAmount)
    }, 0)
  }, [completedDonations, orderByDonationId])

  // Unique orgs that have completed donations
  const completedOrgs = useMemo(() => {
    const orgIds = [...new Set(completedDonations.map(d => d.organizationId))]
    return orgIds.map(id => {
      const org = orgMap.get(id)
      const name = org?.organizationName || org?.name || id.slice(0, 10) + "…"
      return { id, name, count: completedDonations.filter(d => d.organizationId === id).length }
    })
  }, [completedDonations, orgMap])

  // Filtered completed donations by org tab
  const filteredDonations = useMemo(() => {
    if (orgFilter === "All") return completedDonations
    return completedDonations.filter(d => d.organizationId === orgFilter)
  }, [completedDonations, orgFilter])

  // Recommendations: location match = top priority, then most recently posted
  const recommended = useMemo((): RecommendedItem[] => {
    const userCity  = (userDoc as any)?.city?.trim().toLowerCase() ?? ""
    const userState = (userDoc as any)?.state?.trim().toLowerCase() ?? ""

    // Score 0 = same city (best), 1 = same state, 2 = no match
    function locationScore(org: OrganizationDoc): number {
      const orgCity  = org.city?.trim().toLowerCase() ?? ""
      const orgState = org.state?.trim().toLowerCase() ?? ""
      if (userCity  && orgCity  === userCity)  return 0
      if (userState && orgState === userState) return 1
      return 2
    }

    const now = new Date()
    const todayStr = now.toISOString().split("T")[0]

    const twoDaysLaterDate = new Date()
    twoDaysLaterDate.setDate(now.getDate() + 2)
    const twoDaysLaterStr = twoDaysLaterDate.toISOString().split("T")[0]

    const twoDaysAgoDate = new Date()
    twoDaysAgoDate.setDate(now.getDate() - 2)

    const reqItems = requirements
      .filter(r => r.status === "Open" && (r.fulfilledQuantity || 0) === 0)
      .map(r => {
        const org = orgMap.get(r.organizationId)
        if (!org) return null
        const reqDate = tsToDate(r.createdAt)
        const isPrimary = reqDate ? reqDate >= twoDaysAgoDate : false
        return {
          type: "requirement" as const,
          req: r,
          org,
          isPrimary,
          dateValue: reqDate?.getTime() ?? 0,
          location: locationScore(org)
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const slotItems = slots
      .filter(s => s.status === "Available" && (s.sponsored || 0) === 0)
      .map(s => {
        const org = orgMap.get(s.organizationId)
        if (!org) return null
        const isPrimary = s.date >= todayStr && s.date <= twoDaysLaterStr
        return {
          type: "slot" as const,
          slot: s,
          org,
          isPrimary,
          dateValue: new Date(s.date).getTime() || 0,
          location: locationScore(org)
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const sorted = [...reqItems, ...slotItems].sort((a, b) => {
      // 1. High priority requirements on top
      const aPriority = a.type === "requirement" && a.req.priority === "High" ? 0 : 1
      const bPriority = b.type === "requirement" && b.req.priority === "High" ? 0 : 1
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      // 2. Location match
      if (a.location !== b.location) {
        return a.location - b.location
      }
      // 3. Primary (within 2 days) vs Fallback
      if (a.isPrimary !== b.isPrimary) {
        return a.isPrimary ? -1 : 1
      }
      // 4. Recency / nearest date
      return b.dateValue - a.dateValue
    })

    return sorted.map(item => {
      if (item.type === "requirement") {
        return { type: "requirement" as const, req: item.req, org: item.org }
      } else {
        return { type: "slot" as const, slot: item.slot, org: item.org }
      }
    }).slice(0, 4)
  }, [requirements, slots, orgMap, userDoc])

  // Show the one-time profile completion popup for brand-new donors.
  // userDoc is loaded by AuthContext; we wait until it's available and only
  // show the popup when profilePromptSeen is explicitly false/undefined.
  const showProfilePopup =
    !loading &&
    !!user?.uid &&
    !!userDoc &&
    !(userDoc as any).profilePromptSeen

  if (loading) {
    return <div className="py-12 flex justify-center"><Spinner className="size-8" /></div>
  }

  return (
    <>
      {/* One-time profile completion popup */}
      {showProfilePopup && <CompleteProfilePopup uid={user!.uid} />}

      <div className="flex flex-col gap-8" >
        {/* Welcome */}
        <section className="overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground md:p-8">
          <h1 className="text-balance text-2xl font-bold md:text-3xl">
            Welcome back, {userDoc?.name?.split(" ")[0] || "there"}! Thank you for being a changemaker.
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-primary-foreground/80 md:text-base">
            Your generosity has helped serve thousands of meals this year. Here&apos;s a snapshot of your impact so far.
          </p>
          <Button asChild variant="secondary" className="mt-5 rounded-xl">
            <Link href="/donor/browse">Browse Organizations <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </section>

        {/* Stat cards */}
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
            </span>
            <p className="mt-4 text-3xl font-bold text-foreground">₹{totalAmountDonated.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-sm font-medium text-foreground">Total Amount Donated</p>
            <p className="text-xs text-muted-foreground">Meals, items &amp; more · Completed only</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <p className="mt-4 text-3xl font-bold text-green-600">{completedDonations.length}</p>
            <p className="mt-1 text-sm font-medium text-foreground">Completed Donations</p>
            <p className="text-xs text-muted-foreground">Showing these ↓</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <Building2 className="h-5 w-5" />
            </span>
            <p className="mt-4 text-3xl font-bold text-blue-600">{completedOrgs.length}</p>
            <p className="mt-1 text-sm font-medium text-foreground">Organizations Supported</p>
            <p className="text-xs text-muted-foreground">With completed donations</p>
          </div>
        </section>

        {/* My Donations + Recommended */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* My Donations with org filter tabs */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">My Donations</h2>
              <Link href="/donor/donations" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Org filter tabs */}
            {completedOrgs.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setOrgFilter("All")}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${orgFilter === "All" ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground hover:border-primary/40"}`}
                >
                  All <span className="ml-1 text-xs">{completedDonations.length}</span>
                </button>
                {completedOrgs.map(org => (
                  <button
                    key={org.id}
                    onClick={() => setOrgFilter(org.id)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${orgFilter === org.id ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground hover:border-primary/40"}`}
                  >
                    {org.name} <span className="ml-1 text-xs">{org.count}</span>
                  </button>
                ))}
              </div>
            )}

            <p className="mb-3 text-xs text-muted-foreground">
              Showing <strong className="text-foreground">{filteredDonations.length}</strong> completed donations
            </p>

            {/* Donation list */}
            <ul className="flex flex-col gap-3">
              {filteredDonations.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No completed donations yet.</p>
              ) : (
                filteredDonations.map((d) => {
                  const org = orgMap.get(d.organizationId)
                  const orgName = org?.organizationName || org?.name || "Organization"
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-background px-4 py-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                        <HandHeart className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">{d.itemName ? `${d.itemName} Donation` : d.occasion || "Sponsorship"}</p>
                        <p className="text-xs text-muted-foreground">
                          {getDisplayDate(d) !== "—" && <span>{getDisplayDate(d)} · </span>}
                          <span className="font-medium text-foreground">{getContribution(d)}</span>
                          <span> · {orgName}</span>
                        </p>
                      </div>
                      <StatusBadge status={d.status} />
                    </li>
                  )
                })
              )}
            </ul>
          </div>

          {/* Recommended — untouched */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Recommended For You</h2>
            </div>

            {recommended.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">No open requirements or slots right now.</p>
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <Link href="/donor/browse">Browse Organizations</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recommended.map((item) => {
                  if (item.type === "requirement") {
                    const { req, org } = item
                    const orgId = org.orgId || org.uid
                    const remaining = (req.totalQuantity ?? 0) - (req.fulfilledQuantity ?? 0)
                    return (
                      <div key={`req-${req.id}`} className="rounded-xl border border-border p-4 hover:border-primary/40 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground text-sm">{org.organizationName || org.name}</p>
                            {org.city && (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />{org.city}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">{req.priority}</span>
                        </div>
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                          <Package className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium text-foreground">{req.title}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">Needs {remaining} {req.unit} · fully unfulfilled</p>
                        <Button asChild size="sm" className="w-full rounded-lg">
                          <Link href={`/donor/sponsor?org=${orgId}&req=${req.id}&item=${encodeURIComponent(req.title)}&unit=${encodeURIComponent(req.unit)}&remaining=${remaining}`}>
                            Donate Now <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    )
                  } else {
                    const { slot, org } = item
                    const orgId = org.orgId || org.uid
                    const mealsNeeded = (slot.totalNeeded ?? 0) - (slot.sponsored ?? 0)
                    return (
                      <div key={`slot-${slot.id}`} className="rounded-xl border border-border p-4 hover:border-primary/40 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground text-sm">{org.organizationName || org.name}</p>
                            {org.city && (
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />{org.city}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">Slot</span>
                        </div>
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium text-foreground">{slot.title}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mb-3">{slot.date} · {mealsNeeded} meals needed · {slot.mealType ?? "Meal"}</p>
                        <Button asChild size="sm" className="w-full rounded-lg">
                          <Link href={`/donor/sponsor?org=${orgId}&slot=${slot.id}&date=${slot.date}&meals=${mealsNeeded}`}>
                            Sponsor Slot <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    )
                  }
                })}
                <Link href="/donor/browse" className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary">
                  View all organizations <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  )
}