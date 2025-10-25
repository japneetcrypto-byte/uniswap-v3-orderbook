"use client";

export function MarketHeader({
  chain,
  pool,
  symbol0,
  symbol1,
  currentTick,
  quoteToken,
  prices,
  reserves,
  activeLiquidity,
}: {
  chain: string;
  pool: string;
  symbol0: string;
  symbol1: string;
  currentTick: number;
  quoteToken: string;
  prices: {
    currentPriceUSD: number;
    token0USD: number | null;
    token1USD: number | null;
    currentPriceFormatted?: string; // ✅ Add this optional field
  };
  reserves: { token0: number; token1: number };
  activeLiquidity: number;
}) {
  // ✅ CORRECTED: Format small prices with subscript notation
  const formatSmallPrice = (price: number): string => {
    if (price === 0) return '0.00000000';
    
    if (price >= 0.0001) {
      return price.toFixed(8).replace(/\.?0+$/, '');
    }
    
    const priceStr = price.toExponential().toLowerCase();
    const match = priceStr.match(/^([0-9.]+)e(-?\d+)$/);
    
    if (!match) return price.toFixed(8);
    
    const mantissa = parseFloat(match[1]);
    const exponent = parseInt(match[2]);
    
    if (exponent >= -3) {
      return price.toFixed(Math.abs(exponent) + 4);
    }
    
    const mantissaStr = mantissa.toFixed(4).replace('.', '');
    const significantDigits = mantissaStr.replace(/^0+/, '');
    
    const subscriptMap: { [key: string]: string } = {
      '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
      '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
    };
    
    const numZeros = Math.abs(exponent) - 1;
    const subscript = numZeros.toString().split('').map(d => subscriptMap[d]).join('');
    
    return `0.0${subscript}${significantDigits.substring(0, 4)}`;
  };

  const formatUSD = (num: number): string => {
    if (num === 0) return '$0.00';
    
    const absNum = Math.abs(num);
    
    // ✅ Use subscript formatting for very small numbers
    if (absNum < 0.0001) {
      return `$${formatSmallPrice(num)}`;
    }
    
    if (absNum < 0.1) {
      return `$${num.toFixed(4)}`;
    }
    
    if (absNum < 1) {
      return `$${num.toFixed(3)}`;
    }
    
    return `$${num.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {symbol0}/{symbol1}
        </h2>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium capitalize">
          {chain}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500">Current Price</p>
          <p className="text-lg font-semibold">{formatUSD(prices.token0USD || 0)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Current Tick</p>
          <p className="text-lg font-semibold">{currentTick.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Quote Token</p>
          <p className="text-lg font-semibold">{quoteToken}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Active Liquidity</p>
          <p className="text-lg font-semibold">{formatNumber(activeLiquidity || 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded p-3">
          <p className="text-xs text-gray-500 mb-1">{symbol0} Price</p>
          <p className="font-semibold">
            {prices.token0USD ? formatUSD(prices.token0USD) : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-2">Reserve</p>
          <p className="text-sm">
            {reserves.token0 ? formatNumber(reserves.token0) : "—"} {symbol0}
          </p>
        </div>
        <div className="bg-gray-50 rounded p-3">
          <p className="text-xs text-gray-500 mb-1">{symbol1} Price</p>
          <p className="font-semibold">
            {prices.token1USD ? formatUSD(prices.token1USD) : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-2">Reserve</p>
          <p className="text-sm">
            {reserves.token1 ? formatNumber(reserves.token1) : "—"} {symbol1}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => copyToClipboard(pool)}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
        >
          Copy Pool: {formatAddress(pool)}
        </button>
        <button
          onClick={() => copyToClipboard(window.location.href)}
          className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 rounded text-sm text-blue-700"
        >
          Copy Link
        </button>
      </div>
    </div>
  );
}
