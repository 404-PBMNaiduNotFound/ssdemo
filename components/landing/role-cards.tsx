import { HandHeart, Building2, ArrowRight } from "lucide-react"
import Link from "next/link"

const roles = [
  {
    icon: HandHeart,
    title: "I want to donate and make an impact",
    description:
      "Browse verified causes, give securely, and track exactly how your contribution changes lives.",
    cta: "Continue as Donor",
    href: "/login",
  },
  {
    icon: Building2,
    title: "I represent an organization seeking support",
    description:
      "Register your NGO, share your mission, and connect with donors who care about your cause.",
    cta: "Continue as Organization",
    href: "/org/register",
  },
]

export function RoleCards() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid gap-6 md:grid-cols-2">
        {roles.map((role) => {
          const Icon = role.icon
          return (
            <Link
              key={role.title}
              href={role.href}
              className="group flex items-start gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md sm:p-8"
            >
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-7 w-7" />
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-bold leading-snug text-foreground">{role.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{role.description}</p>
                <button className="h-11 rounded-xl font-semibold transition-colors hover:bg-primary/90 hover:text-white active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 mt-4 transition-all duration-200 hover:border-dotted/40 hover:shadow-md sm:p-8 inline-flex items-center gap-1.5 text-sm font-semibold bg-blue text-primary">
                  {role.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
