"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Apple,
  BookOpen,
  Boxes,
  Building2,
  CalendarRange,
  Carrot,
  CheckSquare,
  DoorOpen,
  Gift,
  Globe,
  History,
  Home,
  IndianRupee,
  List,
  LogOut,
  Menu,
  PackagePlus,
  Scale,
  Settings,
  Shirt,
  SprayCan,
  Upload,
  Users,
  UtensilsCrossed,
  Wheat,
  X,
} from "lucide-react";
import { logout } from "@/app/actions";
import { LanguageSwitch } from "./language-switch";
import { cn } from "@/lib/utils";

const ICONS = {
  home: Home,
  building: Building2,
  users: Users,
  history: History,
  globe: Globe,
  settings: Settings,
  wheat: Wheat,
  meal: UtensilsCrossed,
  carrot: Carrot,
  apple: Apple,
  shirt: Shirt,
  spray: SprayCan,
  book: BookOpen,
  rupee: IndianRupee,
  door: DoorOpen,
  boxes: Boxes,
  packagePlus: PackagePlus,
  calendar: CalendarRange,
  gift: Gift,
  check: CheckSquare,
  scale: Scale,
  list: List,
  upload: Upload,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; group?: string };

export function Nav({
  items,
  userName,
  roleLabel,
  menuLabel,
  logoutLabel,
}: {
  items: NavItem[];
  userName: string;
  roleLabel: string;
  menuLabel: string;
  logoutLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Longest matching prefix wins, so /stock/statement does not also light up /stock.
  const activeHref = items
    .map((i) => i.href)
    .filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;

  let lastGroup: string | undefined;
  return (
    <aside className="lg:w-64 lg:shrink-0 print:hidden">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-primary-200 bg-white px-4 text-primary-800 lg:hidden"
        aria-expanded={open}
        aria-controls="main-nav"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-medium">{menuLabel}</span>
        {open ? <X aria-hidden /> : <Menu aria-hidden />}
      </button>
      <nav id="main-nav" className={cn("mt-2 rounded-card border border-primary-100 bg-white p-2 lg:mt-0 lg:block", !open && "hidden")}>
        <div className="mb-2 border-b border-primary-100 px-3 pb-3 pt-1">
          <p className="font-semibold text-ink">{userName}</p>
          <p className="text-sm text-ink-muted">{roleLabel}</p>
          <LanguageSwitch className="mt-2 sm:hidden" />
        </div>
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const heading = item.group && item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.href}>
                {heading && <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">{heading}</p>}
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-ink hover:bg-primary-50",
                    isActive(item.href) && "bg-primary-100 font-semibold text-primary-900",
                  )}
                >
                  <Icon size={20} aria-hidden className="shrink-0 text-primary-600" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="mt-2 border-t border-primary-100 pt-2">
            <form action={logout}>
              <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-ink hover:bg-primary-50">
                <LogOut size={20} aria-hidden className="shrink-0 text-primary-600" />
                <span>{logoutLabel}</span>
              </button>
            </form>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
