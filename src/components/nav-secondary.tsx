"use client";

import * as React from "react";
import { Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useSidebar } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
  }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();
  const [mounted, setMounted] = React.useState(false);
  const [systemPrefersDark, setSystemPrefersDark] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemPrefersDark(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark);
  const isCollapsed = state === "collapsed";

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                size="sm"
                className="gap-2 group-data-[collapsible=icon]:!p-2 group-data-[collapsible=icon]:!justify-center"
              >
                <a href={item.url}>
                  <item.icon />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {item.title}
                  </span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            {isCollapsed ? (
              <SidebarMenuButton
                asChild
                size="sm"
                className="!p-2 group-data-[collapsible=icon]:!p-2"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 cursor-pointer"
                  onClick={() => setTheme(isDark ? "light" : "dark")}
                  aria-label={
                    isDark ? "Switch to light mode" : "Switch to dark mode"
                  }
                >
                  <div className="flex items-center justify-center">
                    {isDark ? (
                      <Moon className="size-4" />
                    ) : (
                      <Sun className="size-4" />
                    )}
                    <span className="sr-only">Dark Mode</span>
                  </div>
                </button>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton asChild size="sm" className="gap-2">
                <label className="flex w-full items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    {isDark ? (
                      <Moon className="size-4" />
                    ) : (
                      <Sun className="size-4" />
                    )}
                    <span>Dark Mode</span>
                  </div>
                  {mounted ? (
                    <Switch
                      checked={isDark}
                      onCheckedChange={(checked) =>
                        setTheme(checked ? "dark" : "light")
                      }
                      className="scale-75"
                    />
                  ) : null}
                </label>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
