"use client";

import * as React from "react";
import {
  Box,
  CircleDollarSign,
  Fuel,
  Github,
  ScrollText,
  Flame,
  History,
  FileCode2,
  Keyboard,
  Hash,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroup,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";

const navItems = {
  inputs: [
    {
      title: "History",
      value: "inputs-history",
      icon: History,
    },
    {
      title: "Custom",
      value: "inputs-custom",
      icon: Keyboard,
    },
    {
      title: "JSON",
      value: "inputs-json",
      icon: FileCode2,
    },
    {
      title: "Tenderly ID",
      value: "inputs-tenderly-id",
      icon: ScrollText,
    },
    {
      title: "Tx Hash",
      value: "inputs-tx-hash",
      icon: Hash,
    },
  ],
  gas: [
    {
      title: "Overview",
      value: "gas-overview",
      icon: Fuel,
    },
  ],
  state: [
    {
      title: "Assets",
      value: "state-assets",
      icon: CircleDollarSign,
    },
    {
      title: "State Changes",
      value: "state-changes",
      icon: ScrollText,
    },
    {
      title: "Logs",
      value: "state-logs",
      icon: Box,
    },
  ],
  secondary: [
    {
      title: "GitHub",
      url: "https://github.com/daivic/execute-onchain",
      icon: Github,
    },
  ],
};

export function AppSidebar({
  activeView,
  onViewChange,
  isConnected,
  address,
  ensName,
  ensAvatar,
  connectors,
  onDisconnect,
  onConnect,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  activeView: string;
  onViewChange: (view: string) => void;
  isConnected: boolean;
  address?: string;
  ensName?: string;
  ensAvatar?: string;
  connectors?: readonly any[];
  onDisconnect: () => void;
  onConnect: (connector: any) => void;
}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader />
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="font-medium gap-2 pl-2 justify-start">
                <Keyboard className="size-4" />
              </SidebarMenuButton>
              <SidebarMenuSub>
                {navItems.inputs.map((item) => (
                  <SidebarMenuSubItem key={item.title}>
                    <SidebarMenuSubButton
                      isActive={activeView === item.value}
                      onClick={() => onViewChange(item.value)}
                      className="gap-2 group-data-[collapsible=icon]:justify-center"
                    >
                      <item.icon className="size-4" />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="font-medium gap-2 pl-2 justify-start">
                <Flame className="size-4" />
              </SidebarMenuButton>
              <SidebarMenuSub>
                {navItems.gas.map((item) => (
                  <SidebarMenuSubItem key={item.title}>
                    <SidebarMenuSubButton
                      isActive={activeView === item.value}
                      onClick={() => onViewChange(item.value)}
                      className="gap-2 group-data-[collapsible=icon]:justify-center"
                    >
                      <item.icon className="size-4" />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton className="font-medium gap-2 pl-2 justify-start">
                <Box className="size-4" />
              </SidebarMenuButton>
              <SidebarMenuSub>
                {navItems.state.map((item) => (
                  <SidebarMenuSubItem key={item.title}>
                    <SidebarMenuSubButton
                      isActive={activeView === item.value}
                      onClick={() => onViewChange(item.value)}
                      className="gap-2 group-data-[collapsible=icon]:justify-center"
                    >
                      <item.icon className="size-4" />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <NavSecondary items={navItems.secondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          isConnected={isConnected}
          address={address}
          ensName={ensName}
          ensAvatar={ensAvatar}
          connectors={connectors}
          onDisconnect={onDisconnect}
          onConnect={onConnect}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
