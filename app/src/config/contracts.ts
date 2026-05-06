export const CURVE_ADDRESS = "0x671366075cc7b3b611de9ecf856e44587a11f303" as const;
export const ROUTER_ADDRESS = "0xa7ddef992fda672717e82698dfa3ff932c26441e" as const;
export const ZAP_ADDRESS = "0xa0ae3693953352fcc9f99226cba2948b5784af16" as const;
export const EURC_ASSIMILATOR_ADDRESS = "0x131A1261977A4f3CCFfBDc0f1a67e79Cea874e94" as const;
export const USDC_ASSIMILATOR_ADDRESS = "0x8d040951e1B2487CDb381BB3C96e838e288fBc3a" as const;

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
