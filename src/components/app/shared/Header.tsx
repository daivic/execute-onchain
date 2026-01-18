import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { IdentityBadge } from "./IdentityBadge";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/theme-provider";
import {
  CircleNotchIcon,
  CopyIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

interface HeaderProps {
  isConnected: boolean;
  address?: string;
  walletEnsName?: string;
  connectors: any[];
  isConnecting: boolean;
  onConnect: (connector: any) => void;
  onDisconnect: () => void;
}

export function Header({
  isConnected,
  address,
  walletEnsName,
  connectors,
  isConnecting,
  onConnect,
  onDisconnect,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="fixed top-0 right-0 z-50 p-6 flex justify-end items-start pointer-events-none">
      <div className="pointer-events-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-10 px-4 bg-background/80 backdrop-blur-lg border shadow-sm rounded-full hover:bg-background/90"
            >
              <IdentityBadge
                address={address}
                ensName={walletEnsName}
                label={!isConnected ? "Connect" : undefined}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl">
            {!isConnected ? (
              <div className="grid gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 pt-1">
                  Select Wallet
                </p>
                <div className="flex flex-col gap-1">
                  {connectors.map((connector) => (
                    <DropdownMenuItem
                      key={connector.uid}
                      className="gap-3 h-10 cursor-pointer"
                      onClick={() => onConnect(connector)}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <CircleNotchIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        <div className="h-5 w-5 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <WalletIcon className="h-3 w-3 text-primary" />
                        </div>
                      )}
                      <span className="font-medium">{connector.name}</span>
                    </DropdownMenuItem>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-1">
                <DropdownMenuItem
                  className="gap-2 cursor-pointer h-9"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(address ?? "");
                      toast.success("Copied to clipboard");
                    } catch {
                      toast.error("Failed to copy");
                    }
                  }}
                >
                  <CopyIcon className="h-4 w-4" />
                  Copy Address
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 cursor-pointer h-9 text-destructive focus:text-destructive focus:bg-destructive/10"
                  onClick={onDisconnect}
                >
                  <SignOutIcon className="h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </div>
            )}

            <div className="h-px bg-border my-2" />

            <div className="flex items-center justify-between px-2 h-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                {theme === "dark" ? (
                  <MoonIcon className="h-4 w-4" />
                ) : (
                  <SunIcon className="h-4 w-4" />
                )}
                <span className="text-xs font-medium">Dark Mode</span>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) =>
                  setTheme(checked ? "dark" : "light")
                }
                className="scale-75 origin-right"
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}


