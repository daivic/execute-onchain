import { useState } from "react";
import { CopyIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function CopyButton({ text, className, size = "md" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const sizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "cursor-pointer shrink-0 text-muted-foreground hover:text-foreground transition-colors opacity-60 hover:opacity-100",
        sizeClasses[size],
        className
      )}
      title={copied ? "Copied!" : "Copy"}
    >
      {copied ? (
        <CheckCircleIcon className={cn("text-success", sizeClasses[size])} />
      ) : (
        <CopyIcon className={sizeClasses[size]} />
      )}
    </button>
  );
}
