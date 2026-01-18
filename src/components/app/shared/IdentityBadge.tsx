import { shortenHex } from "@/lib/format";

interface IdentityBadgeProps {
  address?: string;
  ensName?: string;
  ensAvatar?: string;
  label?: string;
}

export function IdentityBadge({
  address,
  ensName: ensNameProp,
  label,
}: IdentityBadgeProps) {
  const ensName = ensNameProp ?? undefined;
  const displayName =
    ensName ?? (address ? shortenHex(address) : label ?? "Wallet");

  return <span className="text-sm font-medium">{displayName}</span>;
}
