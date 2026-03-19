export function formatUsd(value: number | string): string {
  const num = Number(value) || 0;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

export function formatApy(apy: number, available?: boolean): string {
  if (available === false) return "N/A";
  return `${apy.toFixed(1)}%`;
}

export function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 5)}...${address.slice(-5)}`;
}

export function formatBtc(sats: number): string {
  return `${(sats / 100_000_000).toFixed(4)} BTC`;
}
