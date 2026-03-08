import { useEffect, useState } from "react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { ChevronRight, type LucideIcon } from "lucide-react"
import { Link, usePage } from "@inertiajs/react"

type NavItem = {
  title: string
  href: string
  icon?: LucideIcon | null
  isActive?: boolean
  single?: boolean
  items?: { title: string; href: string; icon?: string }[]
}

/** Exact-path match: handles trailing slashes and query strings */
function isExactMatch(currentUrl: string, href: string): boolean {
  if (href === "#") return false
  const path = currentUrl.split("?")[0].replace(/\/$/, "") || "/"
  const target = href.replace(/\/$/, "") || "/"
  return path === target
}

/** Prefix match used only for parent active-state detection */
function isPrefixMatch(currentUrl: string, href: string): boolean {
  if (href === "#") return false
  const path = currentUrl.split("?")[0]
  const target = href.endsWith("/") ? href : href + "/"
  return path === href || path.startsWith(target)
}

// ── Per-item component so hooks are at component top level ──────────────────

interface NavMainItemProps {
  item: NavItem
  currentUrl: string
}

function NavMainItem({ item, currentUrl }: NavMainItemProps) {
  const hasChildren = !!item.items?.length

  const parentActive =
    typeof item.isActive === "boolean"
      ? item.isActive
      : hasChildren
      ? item.items!.some((child) => isExactMatch(currentUrl, child.href))
      : isPrefixMatch(currentUrl, item.href)

  const [open, setOpen] = useState(parentActive)

  useEffect(() => {
    setOpen(parentActive)
  }, [parentActive])

  // Single item (no submenu)
  if (!hasChildren || item.single) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip={item.title}
          className={parentActive ? "bg-accent text-accent-foreground" : ""}
          aria-current={parentActive ? "page" : undefined}
        >
          <Link href={item.href}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  // Item with submenu
  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            className={parentActive ? "bg-accent text-accent-foreground" : ""}
            aria-expanded={open}
          >
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items?.map((sub) => {
              const subActive = isExactMatch(currentUrl, sub.href)
              return (
                <SidebarMenuSubItem key={sub.title}>
                  <SidebarMenuSubButton
                    asChild
                    className={subActive ? "bg-accent/70 text-accent-foreground" : ""}
                    aria-current={subActive ? "page" : undefined}
                  >
                    <Link href={sub.href}>
                      <span>{sub.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export function NavMain({ items }: { items: NavItem[] }) {
  const page = usePage()
  const currentUrl = (page?.url || "") as string

  return (
    <SidebarGroup className="px-2 py-0">
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <NavMainItem key={item.title} item={item} currentUrl={currentUrl} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
