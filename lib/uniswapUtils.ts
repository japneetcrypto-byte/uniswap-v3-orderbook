import { ethers } from 'ethers'
import { CHAINS, UNISWAP_V3_POOL_ABI, ERC20_ABI, TICK_SPACING } from './constants'
import { PoolState, OrderbookData, BidAskLevel } from './types/orderbook'

export class UniswapV3OrderbookService {
  private provider: ethers.JsonRpcProvider
  private poolContract: ethers.Contract
  private chainName: string
  private poolAddress: string

  constructor(chainName: string, poolAddress: string) {
    const chain = CHAINS[chainName.toUpperCase() as keyof typeof CHAINS]
    if (!chain) throw new Error(`Unsupported chain: ${chainName}`)

    this.provider = new ethers.JsonRpcProvider(chain.rpcUrl)
    this.poolContract = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, this.provider)
    this.chainName = chainName
    this.poolAddress = poolAddress.toLowerCase()
  }

  async getDexScreenerData() {
    try {
      const chainMap: { [key: string]: string } = {
        'ETHEREUM': 'ethereum',
        'BASE': 'base',
        'ARBITRUM': 'arbitrum'
      }
      const dexChain = chainMap[this.chainName.toUpperCase()] || 'ethereum'
      const url = `https://api.dexscreener.com/latest/dex/pairs/${dexChain}/${this.poolAddress}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.pairs && data.pairs.length > 0) {
        return data.pairs[0]
      }
      return null
    } catch (error) {
      console.error('DexScreener fetch error:', error)
      return null
    }
  }

  async getPoolState(): Promise<PoolState> {
    const [slot0, liquidity, token0, token1, fee] = await Promise.all([
      this.poolContract.slot0(),
      this.poolContract.liquidity(),
      this.poolContract.token0(),
      this.poolContract.token1(),
      this.poolContract.fee(),
    ])

    return {
      sqrtPriceX96: slot0.sqrtPriceX96,
      tick: Number(slot0.tick),
      liquidity: liquidity,
      token0,
      token1,
      fee: Number(fee),
    }
  }

  async getTokenInfo(tokenAddress: string) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider)
    const [symbol, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals(),
    ])
    return { symbol, decimals: Number(decimals) }
  }

  tickToPrice(tick: number, token0Decimals: number, token1Decimals: number): number {
    const price = Math.pow(1.0001, tick)
    const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals)
    return price * decimalAdjustment
  }

  async generateOrderbook(mode: string): Promise<OrderbookData> {
    const poolState = await this.getPoolState()
    const [token0Info, token1Info, dexData] = await Promise.all([
      this.getTokenInfo(poolState.token0),
      this.getTokenInfo(poolState.token1),
      this.getDexScreenerData()
    ])

    // Get USD prices from DexScreener
    const token0USD = dexData?.priceUsd ? parseFloat(dexData.priceUsd) : null
    const token1USD = dexData?.quoteToken?.address?.toLowerCase() === poolState.token1.toLowerCase() 
      ? null 
      : (token0USD ? 1 / (token0USD * this.tickToPrice(poolState.tick, token0Info.decimals, token1Info.decimals)) : null)

    // Determine display order (base/quote) from DexScreener
    const isInverted = dexData?.baseToken?.address?.toLowerCase() === poolState.token1.toLowerCase()

    const sqrtPriceX96Number = Number(poolState.sqrtPriceX96) / Math.pow(2, 96)
    const currentPrice = Math.pow(sqrtPriceX96Number, 2) * Math.pow(10, token0Info.decimals - token1Info.decimals)

    const levels = mode.includes('(') ? parseInt(mode.match(/\((\d+)/)?.[1] || '5') : 5
    const tickSpacing = TICK_SPACING[poolState.fee] || 60
    const bids: BidAskLevel[] = []
    const asks: BidAskLevel[] = []

    const liquidityNumber = Number(poolState.liquidity) / Math.pow(10, 18)

    for (let i = 1; i <= levels; i++) {
      const tickIndex = poolState.tick - (i * tickSpacing)
      const price = this.tickToPrice(tickIndex, token0Info.decimals, token1Info.decimals)
      const liquidityAmount = liquidityNumber / levels

      bids.push({
        price: price.toFixed(10),
        amount: liquidityAmount.toFixed(2) + 'M',
        total: '$' + (price * liquidityAmount).toFixed(10),
        tickIndex,
      })
    }

    for (let i = 1; i <= levels; i++) {
      const tickIndex = poolState.tick + (i * tickSpacing)
      const price = this.tickToPrice(tickIndex, token0Info.decimals, token1Info.decimals)
      const liquidityAmount = liquidityNumber / levels

      asks.push({
        price: price.toFixed(10),
        amount: liquidityAmount.toFixed(2) + 'M',
        total: '$' + (price * liquidityAmount).toFixed(10),
        tickIndex,
      })
    }

    const tvl = dexData?.liquidity?.usd ? parseFloat(dexData.liquidity.usd) : liquidityNumber * currentPrice
    const token0Reserve = Number(poolState.liquidity) / Math.pow(10, token0Info.decimals)
    const token1Reserve = Number(poolState.liquidity) / Math.pow(10, token1Info.decimals)

    return {
      pair: isInverted ? `${token1Info.symbol}/${token0Info.symbol}` : `${token0Info.symbol}/${token1Info.symbol}`,
      currentPrice: isInverted ? (1 / currentPrice) : currentPrice,
      priceInverse: isInverted ? currentPrice : (1 / currentPrice),
      quoteToken: isInverted ? token0Info.symbol : token1Info.symbol,
      tvl,
      chain: this.chainName,
      token0: {
        symbol: token0Info.symbol,
        price: token0USD || 0,
        reserve: token0Reserve.toFixed(2) + 'M',
        decimals: token0Info.decimals
      },
      token1: {
        symbol: token1Info.symbol,
        price: token1USD || 0,
        reserve: token1Reserve.toFixed(2),
        decimals: token1Info.decimals
      },
      currentTick: poolState.tick,
      bids: isInverted ? asks : bids.reverse(),
      asks: isInverted ? bids.reverse() : asks,
      isInverted,
      dexData
    }
  }
}
