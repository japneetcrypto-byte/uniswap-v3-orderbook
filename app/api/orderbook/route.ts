import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const { getCache, setCache } = require('@/lib/redis');

const PROVIDERS: Record<string, ethers.JsonRpcProvider> = {
  ethereum: new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com'),
  base: new ethers.JsonRpcProvider('https://base-rpc.publicnode.com'),
  arbitrum: new ethers.JsonRpcProvider('https://arbitrum-one-rpc.publicnode.com'),
};

const POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)',
  'function liquidity() view returns (uint128)',
  'function fee() view returns (uint24)',
  'function tickSpacing() view returns (int24)',
  'function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)',
];

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
];

function formatSmallPrice(price: number): string {
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
}

async function getDexScreenerData(chainId: string, poolAddress: string) {
  try {
    const chainMap: Record<string, string> = { 
      ethereum: 'ethereum', 
      base: 'base', 
      arbitrum: 'arbitrum' 
    };
    const chain = chainMap[chainId.toLowerCase()] || 'ethereum';
    
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/${chain}/${poolAddress}`
    );
    const data = await response.json();
    
    if (data.pair) {
      return {
        baseToken: {
          address: data.pair.baseToken.address,
          symbol: data.pair.baseToken.symbol,
        },
        quoteToken: {
          address: data.pair.quoteToken.address,
          symbol: data.pair.quoteToken.symbol,
        },
        priceUsd: parseFloat(data.pair.priceUsd || '0'),
        volume24h: parseFloat(data.pair.volume?.h24 || '0'),
      };
    }
    return null;
  } catch (error) {
    console.error('DexScreener error:', error);
    return null;
  }
}

// ✅ CORRECTED: Fetch quote token price using known stablecoin pairs
async function getQuoteTokenPrice(
  quoteSymbol: string, 
  quoteAddress: string, 
  chain: string
): Promise<number> {
  try {
    // For stablecoins, always return $1
    const stablecoins = ['USDC', 'USDT', 'DAI', 'USDBC', 'USDC.E', 'FDUSD'];
    if (stablecoins.includes(quoteSymbol.toUpperCase())) {
      console.log(`💰 Quote token (${quoteSymbol}) is stablecoin: $1.00`);
      return 1;
    }

    const chainMap: Record<string, string> = { 
      ethereum: 'ethereum', 
      base: 'base', 
      arbitrum: 'arbitrum' 
    };
    const chainName = chainMap[chain.toLowerCase()] || 'ethereum';
    
    // Fetch token price from DexScreener (standalone)
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${quoteAddress}`
    );
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      // Filter pairs on the correct chain with USD quotes
      const validPairs = data.pairs
        .filter((p: any) => 
          p.chainId === chainName && 
          (p.quoteToken?.symbol === 'WETH' || 
           p.quoteToken?.symbol === 'USDC' || 
           p.quoteToken?.symbol === 'USDT')
        )
        .sort((a: any, b: any) => 
          parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
        );
      
      if (validPairs.length > 0 && validPairs[0].priceUsd) {
        const price = parseFloat(validPairs[0].priceUsd);
        if (price > 0) {
          console.log(`💰 Quote token (${quoteSymbol}) price from DexScreener: $${price}`);
          return price;
        }
      }
    }
    
    console.log(`⚠️  DexScreener failed for ${quoteSymbol}, using fallback`);
    return getFallbackPrice(quoteSymbol);
    
  } catch (error) {
    console.error(`DexScreener quote price error for ${quoteSymbol}:`, error);
    return getFallbackPrice(quoteSymbol);
  }
}

// ✅ Fallback prices
function getFallbackPrice(symbol: string): number {
  const priceMap: Record<string, number> = {
    'WETH': 3800,
    'ETH': 3800,
    'USDC': 1,
    'USDT': 1,
    'DAI': 1,
    'WBTC': 95000,
    'USDBC': 1,
    'CBETH': 4000,
    'ONDO': 0.75,
  };
  return priceMap[symbol.toUpperCase()] || 1;
}

function getLiquidityAtTickLevel(
  tick: number,
  liquidity: number,
  decimals0: number,
  decimals1: number,
  tickSpacing: number
): { amount0: number; amount1: number } {
  
  const tickUpper = tick + tickSpacing;
  
  const sqrtPriceLower = Math.sqrt(1.0001 ** tick);
  const sqrtPriceUpper = Math.sqrt(1.0001 ** tickUpper);
  
  const amount0 = liquidity * ((1 / sqrtPriceLower) - (1 / sqrtPriceUpper));
  const amount1 = liquidity * (sqrtPriceUpper - sqrtPriceLower);
  
  return {
    amount0: amount0 / (10 ** decimals0),
    amount1: amount1 / (10 ** decimals1)
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain') || 'ethereum';
    const pool = searchParams.get('pool');
    const mode = searchParams.get('mode') || 'simple';

    if (!pool) {
      return NextResponse.json({ error: 'Pool address required' }, { status: 400 });
    }

    const cacheKey = `orderbook:${mode}:${chain}:${pool}`;
    const cacheTTL = mode === 'advanced' ? 120 : 60;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      console.log(`💾 Cache HIT: ${pool} (${mode})`);
      return NextResponse.json({ ...cached, cached: true });
    }

    console.log(`🔄 Cache MISS: Computing ${pool} (${mode})`);

    const provider = PROVIDERS[chain.toLowerCase()];
    if (!provider) {
      return NextResponse.json({ error: 'Invalid chain' }, { status: 400 });
    }

    const dexData = await getDexScreenerData(chain, pool);
    const poolContract = new ethers.Contract(pool, POOL_ABI, provider);
    
    let token0Address, token1Address, slot0Data, activeLiquidity, poolFee, tickSpacing;
    
    try {
      [token0Address, token1Address, slot0Data, activeLiquidity, poolFee, tickSpacing] = 
        await Promise.all([
          poolContract.token0(),
          poolContract.token1(),
          poolContract.slot0(),
          poolContract.liquidity(),
          poolContract.fee(),
          poolContract.tickSpacing(),
        ]);
    } catch (error: any) {
      return NextResponse.json({ 
        error: `Invalid Uniswap V3 pool or wrong chain. Pool may not exist on ${chain}.`,
        details: error.message 
      }, { status: 400 });
    }

    const token0 = new ethers.Contract(token0Address, ERC20_ABI, provider);
    const token1 = new ethers.Contract(token1Address, ERC20_ABI, provider);

    const [symbol0, symbol1, decimals0, decimals1, balance0, balance1] = 
      await Promise.all([
        token0.symbol(),
        token1.symbol(),
        token0.decimals(),
        token1.decimals(),
        token0.balanceOf(pool),
        token1.balanceOf(pool),
      ]);

    const baseIsToken0 = dexData 
      ? token0Address.toLowerCase() === dexData.baseToken.address.toLowerCase()
      : true;
    
    const baseSymbol = baseIsToken0 ? symbol0 : symbol1;
    const quoteSymbol = baseIsToken0 ? symbol1 : symbol0;
    const quoteAddress = baseIsToken0 ? token1Address : token0Address;
    
    let basePriceUSD = dexData?.priceUsd || getFallbackPrice(baseSymbol);
    // ✅ UPDATED: Fetch live quote price from DexScreener with stablecoin detection
    let quotePriceUSD = await getQuoteTokenPrice(quoteSymbol, quoteAddress, chain);

    const currentTick = Number(slot0Data[1]);
    const currentPrice = 1.0001 ** currentTick;
    
    const priceToken1PerToken0 = currentPrice * (10 ** (Number(decimals0) - Number(decimals1)));
    const baseInQuote = baseIsToken0 ? priceToken1PerToken0 : (1 / priceToken1PerToken0);

    console.log(`📊 ${baseSymbol}/${quoteSymbol} @ $${basePriceUSD.toFixed(6)}`);
    console.log(`📍 Current Tick: ${currentTick}`);
    console.log(`💧 Active Liquidity: ${activeLiquidity.toString()}`);
    console.log(`🔧 baseIsToken0: ${baseIsToken0}`);

    const reserve0 = Number(ethers.formatUnits(balance0, decimals0));
    const reserve1 = Number(ethers.formatUnits(balance1, decimals1));
    const tvl = (reserve0 * (baseIsToken0 ? basePriceUSD : quotePriceUSD)) + 
                (reserve1 * (baseIsToken0 ? quotePriceUSD : basePriceUSD));

    console.log(`📊 Pool reserves: ${reserve0.toFixed(2)} ${symbol0}, ${reserve1.toFixed(2)} ${symbol1}`);
    console.log(`💰 Quote token (${quoteSymbol}) price: $${quotePriceUSD}`);
    console.log(`💰 Base token (${baseSymbol}) price: $${basePriceUSD}`);

    const spacing = Number(tickSpacing);
    const numLevels = mode === 'advanced' ? 50 : 20;
    
    let warningMessage = null;
    let scannedRange = null;

    const ticksToDouble = Math.log(2) / Math.log(1.0001);
    const ticksTo50Percent = Math.abs(Math.log(0.5) / Math.log(1.0001));
    
    const maxTickLevels = 5000;
    let scanRangeUpper, scanRangeLower;
    
    if (basePriceUSD > 1000) {
      scanRangeUpper = Math.min(Math.floor(ticksTo50Percent / spacing), maxTickLevels);
      scanRangeLower = Math.min(Math.floor(ticksTo50Percent / spacing), maxTickLevels);
      console.log(`   💎 High-value asset ($${basePriceUSD.toFixed(2)}): Using ±50% scan range`);
    } else if (basePriceUSD > 10) {
      const ticksTo20Percent = Math.abs(Math.log(0.8) / Math.log(1.0001));
      scanRangeUpper = Math.min(Math.floor(ticksToDouble / spacing), maxTickLevels);
      scanRangeLower = Math.min(Math.floor(ticksTo20Percent / spacing), maxTickLevels);
      console.log(`   🔷 Mid-value asset ($${basePriceUSD.toFixed(2)}): Using -20% to +100% range`);
    } else {
      const ticksToNearZero = Math.abs(Math.log(0.01) / Math.log(1.0001));
      scanRangeUpper = Math.min(Math.floor(ticksToDouble / spacing), maxTickLevels);
      scanRangeLower = Math.min(Math.floor(ticksToNearZero / spacing), maxTickLevels);
      console.log(`   🔸 Low-value asset ($${basePriceUSD.toFixed(6)}): Using -99% to +100% range`);
    }
    
    const alignedCurrentTick = Math.floor(currentTick / spacing) * spacing;
    
    if (currentTick !== alignedCurrentTick) {
      console.log(`   📍 Aligning tick ${currentTick} → ${alignedCurrentTick} (spacing: ${spacing})`);
    }
    
    const ticksToFetch: number[] = [];
    
    for (let i = -scanRangeLower; i <= scanRangeUpper; i++) {
      if (i === 0) continue;
      const tickToScan = alignedCurrentTick + (i * spacing);
      ticksToFetch.push(tickToScan);
    }

    if (ticksToFetch.length > 0) {
      const firstTick = ticksToFetch[0];
      console.log(`   ✓ Tick alignment verified: ${firstTick} (mod ${spacing} = ${firstTick % spacing})`);
    }

    const totalTicksScanned = (scanRangeLower + scanRangeUpper) * spacing;
    console.log(`🔍 Scanning ${ticksToFetch.length} tick levels (${totalTicksScanned} actual ticks) for initialized positions...`);

    const tickDataPromises = ticksToFetch.map(async (tickIndex) => {
      try {
        const tickData = await poolContract.ticks(tickIndex);
        return {
          tickIndex,
          liquidityGross: BigInt(tickData.liquidityGross.toString()),
          liquidityNet: BigInt(tickData.liquidityNet.toString()),
          initialized: tickData.initialized,
        };
      } catch (error) {
        return {
          tickIndex,
          liquidityGross: BigInt(0),
          liquidityNet: BigInt(0),
          initialized: false,
        };
      }
    });

    const ticksData = await Promise.all(tickDataPromises);
    
    const allTicks = ticksData.length;
    const initializedCount = ticksData.filter(t => t.initialized).length;
    const withLiquidity = ticksData.filter(t => t.liquidityGross > 0).length;
    
    console.log(`📊 Tick Scan Results:`);
    console.log(`   Total ticks checked: ${allTicks}`);
    console.log(`   Initialized (flag=true): ${initializedCount}`);
    console.log(`   With liquidityGross > 0: ${withLiquidity}`);
    
    const initializedTicks = ticksData
      .filter(t => t.initialized || t.liquidityGross > 0)
      .sort((a, b) => a.tickIndex - b.tickIndex);

    console.log(`✅ Found ${initializedTicks.length} ticks with liquidity`);
    
    if (initializedTicks.length > 0) {
      const sampleTicks = initializedTicks.slice(0, 5);
      console.log(`   Sample ticks: ${sampleTicks.map(t => t.tickIndex).join(', ')}...`);
    }

    const ticksBelow = initializedTicks.filter(t => t.tickIndex < currentTick);
    const ticksAbove = initializedTicks.filter(t => t.tickIndex >= currentTick);

    console.log(`📊 Ticks below current: ${ticksBelow.length}`);
    console.log(`📊 Ticks above current: ${ticksAbove.length}`);
    
    const bidTicksSource = baseIsToken0 ? ticksBelow : ticksAbove;
    const askTicksSource = baseIsToken0 ? ticksAbove : ticksBelow;
    
    console.log(`🔧 Using ${bidTicksSource.length} ticks for bids (${baseIsToken0 ? 'ticksBelow' : 'ticksAbove'})`);
    console.log(`🔧 Using ${askTicksSource.length} ticks for asks (${baseIsToken0 ? 'ticksAbove' : 'ticksBelow'})`);
    
    const allLevels: any[] = [];
    const maxQuoteReserve = baseIsToken0 ? reserve1 : reserve0;
    const maxBaseReserve = baseIsToken0 ? reserve0 : reserve1;
    
    // Process bids
    if (bidTicksSource.length > 0) {
      console.log(`🟢 Processing ${bidTicksSource.length} bid tick ranges...`);
      
      let currentLiq = BigInt(activeLiquidity);
      
      for (let i = bidTicksSource.length - 1; i >= 0; i--) {
        const tickLower = bidTicksSource[i].tickIndex;
        
        if (i < bidTicksSource.length - 1) {
          const tickAtBoundary = bidTicksSource[i + 1];
          currentLiq = currentLiq - tickAtBoundary.liquidityNet;
        }
        
        if (currentLiq < 0) break;
        
        const L = Number(currentLiq);
        if (L === 0) continue;
        
        const { amount0, amount1 } = getLiquidityAtTickLevel(
          tickLower,
          L,
          Number(decimals0),
          Number(decimals1),
          spacing
        );
        
        const priceAtTick = (1.0001 ** tickLower) * (10 ** (Number(decimals0) - Number(decimals1)));
        const pairPrice = baseIsToken0 ? priceAtTick : (1 / priceAtTick);
        const priceUSD = pairPrice * quotePriceUSD;
        
        const levelSize = baseIsToken0 ? amount1 : amount0;
        const baseReceived = baseIsToken0 ? amount0 : amount1;
        
        if (levelSize > 0.00001 && priceUSD > 0) {
          allLevels.push({
            type: 'bid',
            price: priceUSD,
            priceFormatted: formatSmallPrice(priceUSD),
            size: levelSize,
            sizeFormatted: levelSize.toFixed(4),
            baseAmount: baseReceived.toFixed(4),
            liquidity: L,
            tickRange: `[${tickLower}, ${tickLower + spacing}]`
          });
        }
      }
    }

    // Process asks
    if (askTicksSource.length > 0) {
      console.log(`🔴 Processing ${askTicksSource.length} ask tick ranges...`);
      
      let currentLiq = BigInt(activeLiquidity);
      
      for (let i = 0; i < askTicksSource.length; i++) {
        const tickLower = askTicksSource[i].tickIndex;
        
        if (i > 0) {
          const tickAtBoundary = askTicksSource[i];
          currentLiq = currentLiq + tickAtBoundary.liquidityNet;
        }
        
        if (currentLiq < 0) break;
        
        const L = Number(currentLiq);
        if (L === 0) continue;
        
        const { amount0, amount1 } = getLiquidityAtTickLevel(
          tickLower,
          L,
          Number(decimals0),
          Number(decimals1),
          spacing
        );
        
        const priceAtTick = (1.0001 ** (tickLower + spacing)) * (10 ** (Number(decimals0) - Number(decimals1)));
        const pairPrice = baseIsToken0 ? priceAtTick : (1 / priceAtTick);
        const priceUSD = pairPrice * quotePriceUSD;
        
        const levelSize = baseIsToken0 ? amount0 : amount1;
        const quoteReceived = baseIsToken0 ? amount1 : amount0;
        
        if (levelSize > 0.00001 && priceUSD > 0) {
          allLevels.push({
            type: 'ask',
            price: priceUSD,
            priceFormatted: formatSmallPrice(priceUSD),
            size: levelSize,
            sizeFormatted: levelSize.toFixed(4),
            quoteAmount: quoteReceived.toFixed(4),
            liquidity: L,
            tickRange: `[${tickLower}, ${tickLower + spacing}]`
          });
        }
      }
    }

    console.log(`📊 Total levels collected: ${allLevels.length}`);

    const bidsRaw = allLevels
      .filter(level => level.price < basePriceUSD)
      .sort((a, b) => b.price - a.price);
    
    const asksRaw = allLevels
      .filter(level => level.price >= basePriceUSD)
      .sort((a, b) => a.price - b.price);

    console.log(`📊 Split: ${bidsRaw.length} bids (< $${basePriceUSD}), ${asksRaw.length} asks (>= $${basePriceUSD})`);

    // Build final bids with cumulative totals
    const bids: any[] = [];
    let runningBidTotalUSD = 0;
    
    for (let i = 0; i < Math.min(bidsRaw.length, numLevels); i++) {
      const level = bidsRaw[i];
      const levelUSD = level.size * quotePriceUSD;
      
      if (runningBidTotalUSD / quotePriceUSD + level.size > maxQuoteReserve) {
        console.log(`⚠️  Bids: Reached pool reserve limit`);
        break;
      }
      
      runningBidTotalUSD += levelUSD;
      
      bids.push({
        price: level.priceFormatted,
        size: level.sizeFormatted,
        baseAmount: level.baseAmount,
        total: runningBidTotalUSD.toFixed(2),
        ...(mode === 'advanced' && { 
          liquidity: level.liquidity.toExponential(2),
          tickRange: level.tickRange 
        }),
      });
    }

    // Build final asks with cumulative totals
    const asks: any[] = [];
    let runningAskTotalUSD = 0;
    
    for (let i = 0; i < Math.min(asksRaw.length, numLevels); i++) {
      const level = asksRaw[i];
      const levelUSD = level.size * basePriceUSD;
      
      if (runningAskTotalUSD / basePriceUSD + level.size > maxBaseReserve) {
        console.log(`⚠️  Asks: Reached pool reserve limit`);
        break;
      }
      
      runningAskTotalUSD += levelUSD;
      
      asks.push({
        price: level.priceFormatted,
        size: level.sizeFormatted,
        quoteAmount: level.quoteAmount,
        total: runningAskTotalUSD.toFixed(2),
        ...(mode === 'advanced' && { 
          liquidity: level.liquidity.toExponential(2),
          tickRange: level.tickRange 
        }),
      });
    }

    console.log(`✅ Final: ${bids.length} bids (depth: $${runningBidTotalUSD.toFixed(2)}), ${asks.length} asks (depth: $${runningAskTotalUSD.toFixed(2)})`);

    // ✅ NEW CODE (Vercel-compatible)
    const result: any = {
    chain,
    chainId: chain === 'ethereum' ? 1 : chain === 'base' ? 8453 : 42161,
    pool,
    symbol0: baseSymbol,
    symbol1: quoteSymbol,
    decimals0: baseIsToken0 ? Number(decimals0) : Number(decimals1),
    decimals1: baseIsToken0 ? Number(decimals1) : Number(decimals0),
    quoteToken: quoteSymbol,
    currentTick,
    activeLiquidity: tvl,
    prices: {
    token0USD: basePriceUSD,
    token1USD: quotePriceUSD,
    currentPriceUSD: basePriceUSD,
    currentPriceFormatted: formatSmallPrice(basePriceUSD),
    },
    reserves: {
    token0: baseIsToken0 ? reserve0 : reserve1,
    token1: baseIsToken0 ? reserve1 : reserve0,
    },
    bids,
    asks,
    mode,
    timestamp: new Date().toISOString(),
    cached: false,
    };

// Add optional fields only if they exist
if (warningMessage) result.warningMessage = warningMessage;
if (scannedRange) result.scannedRange = scannedRange;


    await setCache(cacheKey, result, cacheTTL);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
