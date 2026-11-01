import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { localName } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { LanguageSwitch } from "@/components/language-switch";
import { Nav, type NavItem } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const t = await getTranslations();
  const { locale } = await getFormatPrefs();
  const db = tenantDb(session.clientId);

  const [client, institution] = await Promise.all([
    prisma.client.findUnique({ where: { id: session.clientId } }),
    session.institutionId ? db.institution.findFirst({ where: { id: session.institutionId } }) : null,
  ]);

  const isAdmin = session.role === "ADMIN";
  const reg = t("nav.registers");
  const stock = t("nav.stock");
  const admin = t("nav.administration");
  const items: NavItem[] = [
    { href: "/", label: t("nav.dashboard"), icon: "home" },
    { href: "/registers/grain", label: t("modules.grain"), icon: "wheat", group: reg },
    { href: "/registers/meals", label: t("modules.meals"), icon: "meal", group: reg },
    { href: "/registers/vegetables", label: t("modules.vegetables"), icon: "carrot", group: reg },
    { href: "/registers/fruit", label: t("modules.fruit"), icon: "apple", group: reg },
    { href: "/registers/personal", label: t("modules.personal"), icon: "shirt", group: reg },
    { href: "/registers/cleaning", label: t("modules.cleaning"), icon: "spray", group: reg },
    { href: "/registers/utensils", label: t("modules.utensils"), icon: "book", group: reg },
    { href: "/registers/expenses", label: t("modules.expenses"), icon: "rupee", group: reg },
    { href: "/gate", label: t("modules.gate"), icon: "door", group: reg },
    { href: "/stock", label: t("stock.title"), icon: "boxes", group: stock },
    { href: "/registers/purchase", label: t("modules.purchase"), icon: "packagePlus", group: stock },
    { href: "/stock/statement", label: t("nav.statement"), icon: "calendar", group: stock },
    { href: "/donations", label: t("nav.donations"), icon: "gift", group: stock },
    ...(isAdmin
      ? ([
          { href: "/approvals", label: t("nav.approvals"), icon: "check", group: admin },
          { href: "/registers/adjustment", label: t("modules.adjustment"), icon: "scale", group: admin },
          { href: "/items", label: t("nav.items"), icon: "list", group: admin },
          { href: "/imports", label: t("nav.imports"), icon: "upload", group: admin },
          { href: "/admin/institutions", label: t("nav.institutions"), icon: "building", group: t("nav.administration") },
          { href: "/admin/users", label: t("nav.users"), icon: "users", group: t("nav.administration") },
          { href: "/audit", label: t("nav.audit"), icon: "history", group: t("nav.administration") },
        ] as NavItem[])
      : []),
    ...(session.canManageClients
      ? ([{ href: "/admin/clients", label: t("nav.clients"), icon: "globe", group: t("nav.administration") }] as NavItem[])
      : []),
    { href: "/settings", label: t("nav.settings"), icon: "settings" },
  ];

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        {t("common.skipToContent")}
      </a>
      <header className="sticky top-0 z-30 border-b border-primary-100 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link href="/" className="shrink-0" aria-label={t("nav.home")}>
            <Image src="/palawi-logo.png" alt={`${t("app.name")} — ${t("app.tagline")}`} width={132} height={50} priority />
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-primary-800">{client ? localName(client, locale) : ""}</p>
            <p className="truncate text-xs text-ink-muted">{institution ? localName(institution, locale) : t("home.noInstitution")}</p>
          </div>
          <LanguageSwitch className="hidden sm:inline-flex" />
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4 lg:flex-row lg:py-6 print:block print:max-w-none print:p-0">
        <Nav
          items={items}
          userName={session.name}
          roleLabel={t(`roles.${session.role}`)}
          menuLabel={t("common.menu")}
          logoutLabel={t("nav.logout")}
        />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
