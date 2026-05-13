export const EURC = {
  address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42" as const,
  symbol: "EURC",
  name: "Euro Coin",
  decimals: 6,
} as const;

export const USDC = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
} as const;

export const XSGD = {
  address: "0x0A4C9cb2778aB3302996A34BeFCF9a8Bc288C33b" as const,
  symbol: "XSGD",
  name: "Singapore Dollar Token",
  decimals: 6,
} as const;

export type Token = typeof EURC | typeof USDC | typeof XSGD;
