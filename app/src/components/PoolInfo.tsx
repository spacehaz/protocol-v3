"use client";

import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { curveAbi, erc20Abi, assimilatorAbi, type PoolConfig } from "@/config/contracts";

export function PoolInfo({ pool }: { pool: PoolConfig }) {
  const { address } = useAccount();

  // Base token balance in the Curve pool
  const { data: baseBalance } = useReadContract({
    address: pool.baseToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [pool.curveAddress],
  });

  // Quote token (USDC) balance in the Curve pool
  const { data: quoteBalance } = useReadContract({
    address: pool.quoteToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [pool.curveAddress],
  });

  // Liquidity in USD terms (18 decimals)
  const { data: liquidityData } = useReadContract({
    address: pool.curveAddress,
    abi: curveAbi,
    functionName: "liquidity",
  });

  // Total LP supply
  const { data: totalSupply } = useReadContract({
    address: pool.curveAddress,
    abi: curveAbi,
    functionName: "totalSupply",
  });

  // Oracle rate from base assimilator (8 decimals)
  const { data: oracleRate } = useReadContract({
    address: pool.baseAssimilatorAddress,
    abi: assimilatorAbi,
    functionName: "getRate",
  });

  // User LP balance
  const { data: userLpBalance } = useReadContract({
    address: pool.curveAddress,
    abi: curveAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const totalLiquidity = liquidityData
    ? Number(formatUnits(liquidityData[0], 18))
    : null;

  const baseLiq =
    liquidityData && liquidityData[1]?.length > 0
      ? Number(formatUnits(liquidityData[1][0], 18))
      : null;

  const quoteLiq =
    liquidityData && liquidityData[1]?.length > 1
      ? Number(formatUnits(liquidityData[1][1], 18))
      : null;

  const oracleRateFormatted = oracleRate
    ? (Number(oracleRate) / 1e8).toFixed(4)
    : null;

  const basePct =
    baseLiq !== null && totalLiquidity !== null && totalLiquidity > 0
      ? (baseLiq / totalLiquidity) * 100
      : null;

  const quotePct =
    quoteLiq !== null && totalLiquidity !== null && totalLiquidity > 0
      ? (quoteLiq / totalLiquidity) * 100
      : null;

  const userSharePct =
    userLpBalance && totalSupply && totalSupply > 0n
      ? (Number(userLpBalance) / Number(totalSupply)) * 100
      : 0;

  const baseSymbol = pool.baseToken.symbol;
  const quoteSymbol = pool.quoteToken.symbol;

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-4">
      <h2 className="text-lg font-semibold">{pool.name} Pool</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox
          label={`${baseSymbol} in Pool`}
          value={
            baseBalance !== undefined
              ? Number(formatUnits(baseBalance, pool.baseToken.decimals)).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 2 }
                )
              : "..."
          }
        />
        <StatBox
          label={`${quoteSymbol} in Pool`}
          value={
            quoteBalance !== undefined
              ? Number(formatUnits(quoteBalance, pool.quoteToken.decimals)).toLocaleString(
                  undefined,
                  { maximumFractionDigits: 2 }
                )
              : "..."
          }
        />
        <StatBox
          label="Total Liquidity (USD)"
          value={
            totalLiquidity !== null
              ? `$${totalLiquidity.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              : "..."
          }
        />
        <StatBox
          label="Total LP Supply"
          value={
            totalSupply !== undefined
              ? Number(formatUnits(totalSupply, 18)).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : "..."
          }
        />
        <StatBox
          label="Oracle Rate"
          value={
            oracleRateFormatted
              ? `1 ${baseSymbol} = ${oracleRateFormatted} USD`
              : "..."
          }
        />
        <StatBox
          label="Pool Balance"
          value={
            basePct !== null && quotePct !== null
              ? `${baseSymbol} ${basePct.toFixed(1)}% / ${quoteSymbol} ${quotePct.toFixed(1)}%`
              : "..."
          }
        />
      </div>

      {/* Pool composition bar */}
      {basePct !== null && quotePct !== null && (
        <div className="px-1 space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{baseSymbol} {basePct.toFixed(1)}%</span>
            <span>{quoteSymbol} {quotePct.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden flex">
            <div
              className="h-full bg-indigo-500 rounded-l-full"
              style={{ width: `${basePct}%` }}
            />
            <div
              className="h-full bg-emerald-500 rounded-r-full"
              style={{ width: `${quotePct}%` }}
            />
          </div>
        </div>
      )}

      {baseLiq !== null && quoteLiq !== null && (
        <div className="text-sm text-zinc-400 space-y-1 px-1">
          <div className="flex justify-between">
            <span>Base liquidity (USD)</span>
            <span>${baseLiq.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span>Quote liquidity (USD)</span>
            <span>${quoteLiq.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      {address && (
        <div className="rounded-xl bg-zinc-800 p-3">
          <div className="text-sm text-zinc-400 mb-1">Your LP Position</div>
          <div className="flex justify-between items-baseline">
            <span className="text-xl font-semibold">
              {userLpBalance !== undefined
                ? Number(formatUnits(userLpBalance, 18)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 4 }
                  )
                : "0"}
            </span>
            <span className="text-sm text-zinc-400">
              {userSharePct.toFixed(4)}% of pool
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-800 p-3">
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
