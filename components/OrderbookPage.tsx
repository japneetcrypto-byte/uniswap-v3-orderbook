"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MarketHeader } from "./MarketHeader";
import { OrderbookTable } from "./OrderbookTable";
import { RefreshBadge } from "./RefreshBadge";
import { ErrorAlert } from "./ErrorAlert";
import { LoadingOrderbook } from "./LoadingOrderbook";

interface OrderbookData {
  chain: string;
  pool: string;
  symbol0: string;
  symbol1: string;
  currentTick: number;
  quoteToken: string;
  prices: {
    token0USD: number;
    token1USD: number;
    currentPriceUSD: number;
  };
  reserves: {
    token0: number;
    token1: number;
  };
  activeLiquidity: number;
  bids: any[];
  asks: any[];
  mode: string;
  timestamp: string;
  cached: boolean;
  warningMessage?: string;
  scannedRange?: any;
}

export function OrderbookPage({
  initialChain = "ethereum",
  initialPool = "",
  initialMode = "simple",
}: {
  initialChain?: string;
  initialPool?: string;
  initialMode?: string;
}) {
  const [chain, setChain] = useState(initialChain);
  const [pool, setPool] = useState(initialPool);
  const [mode, setMode] = useState<"simple" | "advanced">(initialMode as "simple" | "advanced");
  const [data, setData] = useState<OrderbookData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [canFetch, setCanFetch] = useState<boolean>(true);

  const shouldAutoFetch = useRef(false);

  const fetchOrderbook = useCallback(async (forceMode?: "simple" | "advanced", skipCache?: boolean) => {
    if (!pool) return;

    const fetchMode = forceMode || mode;
    
    console.log(`🔵 Fetching orderbook with mode: ${fetchMode}${skipCache ? ' (skip cache)' : ''}`);

    setLoading(true);
    setError(null);
    setCanFetch(false);

    try {
      const url = skipCache 
        ? `/api/orderbook?chain=${chain}&pool=${pool}&mode=${fetchMode}&t=${Date.now()}`
        : `/api/orderbook?chain=${chain}&pool=${pool}&mode=${fetchMode}`;
      
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch orderbook');
      }

      const result = await response.json();
      setData(result);
      setLastUpdated(Date.now());
    } catch (err: any) {
      setError(err.message);
      setData(null);
      setCanFetch(true);
    } finally {
      setLoading(false);
    }
  }, [chain, pool, mode]);

  useEffect(() => {
    if (shouldAutoFetch.current && pool && data) {
      console.log(`🔄 Mode changed to: ${mode}, auto-fetching...`);
      fetchOrderbook(mode, false);
    }
    shouldAutoFetch.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleFetch = () => {
    if (canFetch) {
      console.log('🔄 Manual fetch triggered');
      fetchOrderbook(undefined, false);
    }
  };

  const handleRefresh = () => {
    console.log('♻️ Refresh triggered - bypassing cache');
    fetchOrderbook(undefined, true);
  };

  const handleChainChange = (newChain: string) => {
    setChain(newChain);
    setData(null);
    setLastUpdated(null);
    setCanFetch(true);
    shouldAutoFetch.current = false;
  };

  const handlePoolChange = (newPool: string) => {
    setPool(newPool);
    setData(null);
    setLastUpdated(null);
    setCanFetch(true);
    shouldAutoFetch.current = false;
  };

  const handleModeChange = (newMode: "simple" | "advanced") => {
    console.log(`🎯 Mode changing from ${mode} to ${newMode}`);
    setMode(newMode);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Uniswap V3 Orderbook
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* Chain Select - ✅ ONLY 3 CHAINS */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chain
              </label>
              <select
                value={chain}
                onChange={(e) => handleChainChange(e.target.value)}
                className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-[48px]"
              >
                <option value="ethereum">Ethereum</option>
                <option value="base">Base</option>
                <option value="arbitrum">Arbitrum</option>
              </select>
            </div>

            {/* Pool Address Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pool Address
              </label>
              <input
                type="text"
                value={pool}
                onChange={(e) => handlePoolChange(e.target.value)}
                placeholder="Enter Uniswap V3 pool contract address"
                className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 h-[48px]"
              />
            </div>

            {/* Mode Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mode
              </label>
              <select
                value={mode}
                onChange={(e) => handleModeChange(e.target.value as "simple" | "advanced")}
                className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer h-[48px]"
                disabled={loading}
              >
                <option value="simple">Simple</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            {/* Fetch Button */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 opacity-0">
                Action
              </label>
              <button
                onClick={handleFetch}
                disabled={!pool || loading || !canFetch}
                className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors h-[48px]"
              >
                {loading ? "Loading..." : "Fetch Orderbook"}
              </button>
            </div>
          </div>

          {error && <ErrorAlert message={error} />}
        </div>

        {loading && <LoadingOrderbook mode={mode} />}

        {!loading && data && (
          <>
            <MarketHeader
              symbol0={data.symbol0}
              symbol1={data.symbol1}
              chain={data.chain}
              currentTick={data.currentTick}
              activeLiquidity={data.activeLiquidity}
              quoteToken={data.quoteToken}
              prices={data.prices}
              reserves={data.reserves}
              pool={data.pool}
            />

            <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
              <RefreshBadge 
                lastUpdated={lastUpdated} 
                onRefresh={handleRefresh}
                onCooldownComplete={() => setCanFetch(true)}
                loading={loading}
                mode={mode}
              />
            </div>

            <OrderbookTable
              bids={data.bids}
              asks={data.asks}
              quoteToken={data.quoteToken}
              baseToken={data.symbol0}
            />
          </>
        )}
      </div>
    </div>
  );
}
