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
  icon?: LucideIcon
  isActive?: boolean
  single?: boolean
  items?: { title: string; href: string }[]
}

export function NavMain({ items }: { items: NavItem[] }) {
  const page = usePage()
  const currentUrl = (page?.url || "") as string

  const isMatch = (href: string) => currentUrl.startsWith(href)

  return (
    <SidebarGroup className="px-2 py-0">
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = !!item.items?.length
          const parentActiveFromChildren = hasChildren
            ? item.items!.some((child) => isMatch(child.href))
            : false

          const parentActive =
            typeof item.isActive === "boolean"
              ? item.isActive
              : hasChildren
              ? parentActiveFromChildren
              : isMatch(item.href)

          // State for collapsible menu
          const [open, setOpen] = useState(parentActive)

          // Auto close if not active, auto open if active
          useEffect(() => {
            setOpen(parentActive)
          }, [parentActive])

          // Case 1: Single (no submenu)
          if (!hasChildren || item.single) {
            return (
              <SidebarMenuItem key={item.title}>
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

          // Case 2: Has submenu
          return (
            <Collapsible
              key={item.title}
              asChild
              open={open} // controlled
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
                      const subActive = isMatch(sub.href)
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
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}