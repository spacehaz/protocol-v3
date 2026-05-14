import { EURC, USDC, XSGD, type Token } from "./tokens";

// Backward-compatible flat exports
export const CURVE_ADDRESS = "0x671366075cc7b3b611de9ecf856e44587a11f303" as const;
export const ROUTER_ADDRESS = "0xcfda3c254c7713756aec807838d6d758ab36e412" as const;
export const ZAP_ADDRESS = "0xdcab4ae3fbff8bdb530b230fa3663c2d0fa8f79c" as const;
export const EURC_ASSIMILATOR_ADDRESS = "0x32556aD44D063Eea846327D8818c397B9163a4A6" as const;
export const USDC_ASSIMILATOR_ADDRESS = "0x8d040951e1B2487CDb381BB3C96e838e288fBc3a" as const;

// Pool registry
export interface PoolConfig {
  id: string;
  name: string;
  curveAddress: `0x${string}`;
  baseToken: Token;
  quoteToken: Token;
  baseAssimilatorAddress: `0x${string}`;
}

export type PoolId = "eurc-usdc" | "xsgd-usdc";

export const POOLS: Record<PoolId, PoolConfig> = {
  "eurc-usdc": {
    id: "eurc-usdc",
    name: "EURC / USDC",
    curveAddress: "0x80ba6376c0Ea9A14C1d4411C3639e87d441A6b72",
    baseToken: EURC,
    quoteToken: USDC,
    baseAssimilatorAddress: "0x32556aD44D063Eea846327D8818c397B9163a4A6",
  },
  "xsgd-usdc": {
    id: "xsgd-usdc",
    name: "XSGD / USDC",
    curveAddress: "0xbBb18Abd9aC5D0470B49494D074b2C9f161ccf09",
    baseToken: XSGD,
    quoteToken: USDC,
    baseAssimilatorAddress: "0x6e9d5d4F7757063C3A6a122C34879ac0979f2602",
  },
};

export const DEFAULT_POOL_ID: PoolId = "eurc-usdc";

export const assimilatorAbi = [
  {
    name: "getRate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "oracleDecimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const curveAbi = [
  {
    name: "viewOriginSwap",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_origin", type: "address" },
      { name: "_target", type: "address" },
      { name: "_originAmount", type: "uint256" },
    ],
    outputs: [{ name: "tNAmt_", type: "uint256" }],
  },
  {
    name: "originSwap",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_origin", type: "address" },
      { name: "_target", type: "address" },
      { name: "_originAmount", type: "uint256" },
      { name: "_minTargetAmount", type: "uint256" },
      { name: "_deadline", type: "uint256" },
    ],
    outputs: [{ name: "tNAmt_", type: "uint256" }],
  },
  {
    name: "viewDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_deposit", type: "uint256" }],
    outputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256[]" },
    ],
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_deposit", type: "uint256" },
      { name: "_minQuoteAmount", type: "uint256" },
      { name: "_minBaseAmount", type: "uint256" },
      { name: "_maxQuoteAmount", type: "uint256" },
      { name: "_maxBaseAmount", type: "uint256" },
      { name: "_deadline", type: "uint256" },
    ],
    outputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256[]" },
    ],
  },
  {
    name: "liquidity",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "total_", type: "uint256" },
      { name: "individual_", type: "uint256[]" },
    ],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;
