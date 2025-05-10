import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function getSolanaExplorerUrl(signature: string): string {
  // Use mainnet-beta, devnet, or testnet as needed
  const cluster = "devnet";
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

export function truncateAddress(address: string, length = 4): string {
  if (!address) return "";
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}
