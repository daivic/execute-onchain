import type { Address } from "viem";
import { isAddress, formatUnits } from "viem";

export function shortenHex(hex: string, left = 6, right = 4) {
  if (hex.length <= left + right + 2) return hex;
  return `${hex.slice(0, left + 2)}…${hex.slice(-right)}`;
}

export function shortenString(str: string, left = 14, right = 10) {
  if (str.length <= left + right + 1) return str;
  return `${str.slice(0, left)}…${str.slice(-right)}`;
}

export function formatIntString(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function hexToBigIntSafe(value: unknown) {
  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    if (!Number.isInteger(value)) return undefined;
    if (value < 0) return undefined;
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }

  if (typeof value !== "string") return undefined;
  const s = value.trim();
  if (!s) return undefined;

  if (/^0x[0-9a-fA-F]+$/.test(s)) {
    try {
      return BigInt(s);
    } catch {
      return undefined;
    }
  }

  if (/^\d+$/.test(s)) {
    try {
      return BigInt(s);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function formatHexToDecimal(value: unknown) {
  const bi = hexToBigIntSafe(value);
  if (bi === undefined) return undefined;
  return formatIntString(bi.toString());
}

export function toDisplayString(value: unknown, maxLen = 96) {
  if (value === undefined) return { display: "—" as const };
  if (value === null)
    return { display: "null" as const, title: "null" as const };

  if (typeof value === "string") {
    const title = value;
    if (/^\d+$/.test(value)) return { display: formatIntString(value), title };
    if (isAddress(value)) return { display: shortenHex(value), title };
    if (/^0x[0-9a-fA-F]+$/.test(value) && value.length > maxLen)
      return { display: shortenHex(value, 10, 10), title };
    if (value.length > maxLen)
      return { display: shortenString(value, 56, 18), title };
    return { display: value };
  }

  if (typeof value === "number") return { display: value.toLocaleString() };
  if (typeof value === "boolean") return { display: value ? "true" : "false" };
  if (typeof value === "bigint")
    return { display: formatIntString(value.toString()) };

  try {
    const title = JSON.stringify(value);
    if (title.length > maxLen)
      return { display: shortenString(title, 56, 18), title };
    return { display: title };
  } catch {
    return { display: String(value) };
  }
}

export function sanitizeHexInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const noWhitespace = trimmed.replace(/\s+/g, "");

  if (noWhitespace.startsWith("0x") || noWhitespace.startsWith("0X")) {
    return `0x${noWhitespace.slice(2)}`;
  }

  if (/^[0-9a-fA-F]+$/.test(noWhitespace)) return `0x${noWhitespace}`;

  return noWhitespace;
}

const SUBSCRIPT_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function toSubscript(num: number): string {
  return num
    .toString()
    .split("")
    .map((d) => SUBSCRIPT_DIGITS[parseInt(d)])
    .join("");
}

export function formatEthValue(value: bigint, maxDecimals = 6) {
  const absVal = value < 0n ? -value : value;
  if (absVal === 0n) return "0 ETH";

  const str = formatUnits(absVal, 18);

  // Check for small decimal pattern with leading zeros
  if (str.startsWith("0.0")) {
    const match = str.match(/^0\.(0+)(.*)$/);
    if (match) {
      const zeros = match[1].length;
      const rest = match[2];
      // Use subscript notation for 3 or more zeros
      if (zeros >= 3) {
        const significant = rest.slice(0, 4); // Keep up to 4 significant digits
        return `0.0${toSubscript(zeros)}${significant} ETH`;
      }
    }
  }

  const n = Number.parseFloat(str);
  return `${n.toLocaleString(undefined, {
    maximumFractionDigits: maxDecimals,
  })} ETH`;
}

