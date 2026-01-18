import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";
import { shortenHex } from "@/lib/format";
import {
  getExplorerAddressUrl,
  getExplorerIcon,
  getExplorerName,
} from "@/lib/chains";

interface ContractAddressProps {
  address: string;
  chainId?: number;
  /** Optional human-friendly label (e.g. contract name). */
  label?: string;
  /** Optional className for the label. */
  labelClassName?: string;
  /** Whether to show label when provided. */
  showLabel?: boolean;
  className?: string;
  showCopy?: boolean;
  showExplorer?: boolean;
  shorten?: boolean;
  left?: number;
  right?: number;
  /** Optional resolved name (ENS / Base name / contract label). */
  resolvedName?: string;
}

export function ContractAddress({
  address,
  chainId,
  label,
  labelClassName,
  showLabel = true,
  className,
  showCopy = true,
  showExplorer = true,
  shorten = true,
  left,
  right,
  resolvedName,
}: ContractAddressProps) {
  const resolvedLabel =
    (typeof label === "string" && label.trim().length
      ? label.trim()
      : undefined) ??
    (typeof resolvedName === "string" && resolvedName.trim().length
      ? resolvedName.trim()
      : undefined);
  const displayAddress = shorten ? shortenHex(address, left, right) : address;
  const explorerUrl = chainId
    ? getExplorerAddressUrl(chainId, address)
    : undefined;

  return (
    <div
      className={cn("inline-flex items-center gap-1.5 font-mono", className)}
    >
      {showLabel && resolvedLabel ? (
        <>
          <span
            className={cn(
              "font-sans text-xs font-medium text-foreground max-w-[240px] truncate",
              labelClassName
            )}
            title={resolvedLabel}
          >
            {resolvedLabel}
          </span>
          <span className="text-muted-foreground/60">·</span>
        </>
      ) : null}
      <span>{displayAddress}</span>
      {showCopy && <CopyButton text={address} size="sm" />}
      {showExplorer && explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer shrink-0 text-muted-foreground hover:text-foreground transition-colors opacity-60 hover:opacity-100"
          title="View in Explorer"
        >
          <img
            src={getExplorerIcon(chainId ?? 1)}
            className="h-2.5 w-2.5"
            alt={getExplorerName(chainId ?? 1)}
          />
        </a>
      )}
    </div>
  );
}
