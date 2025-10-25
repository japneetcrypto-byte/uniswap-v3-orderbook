export type PoolState = {
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  token0: string;
  token1: string;
  fee: number;
};

export type BidAskLevel = {
  price: string;
  amount: string;
  total: string;
  tickIndex: number;
};

export type OrderbookData = {
  pair: string;
  currentPrice: number;
  priceInverse: number;
  quoteToken: string;
  tvl: number;
  chain: string;
  token0: {
    symbol: string;
    price: number;
    reserve: string;
    decimals?: number;
  };
  token1: {
    symbol: string;
    price: number;
    reserve: string;
    decimals?: number;
  };
  currentTick: number;
  bids: BidAskLevel[];
  asks: BidAskLevel[];
  isInverted?: boolean;
  dexData?: any;
};
