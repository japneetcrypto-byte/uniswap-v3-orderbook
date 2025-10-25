export const CHAINS = {
  ETHEREUM: {
    id: 1,
    name: 'Ethereum',
    rpcUrl: process.env.ETH_RPC_URL || 'https://ethereum.publicnode.com',
  },
  BASE: {
    id: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://base.publicnode.com',
  },
  ARBITRUM: {
    id: 42161,
    name: 'Arbitrum',
    rpcUrl: process.env.ARB_RPC_URL || 'https://arbitrum.publicnode.com',
  },
}

export const UNISWAP_V3_POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
]

export const ERC20_ABI = [
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
]

export const TICK_SPACING: { [key: number]: number } = {
  500: 10,
  3000: 60,
  10000: 200,
}
