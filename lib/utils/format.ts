export function formatUSD(num: number): string {
  if (num === 0) return '$0.00';
  
  const absNum = Math.abs(num);
  
  // Very small prices - scientific notation
  if (absNum < 0.00001) {
    return `$${num.toExponential(2)}`;
  }
  
  // Small prices (< $0.10) - show 4 decimals
  if (absNum < 0.1) {
    return `$${num.toFixed(4)}`;
  }
  
  // Prices between $0.10 and $1 - show 3 decimals
  if (absNum < 1) {
    return `$${num.toFixed(3)}`;
  }
  
  // Normal prices ($1+) - show 2 decimals with commas
  return `$${num.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
