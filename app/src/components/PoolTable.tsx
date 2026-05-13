"use client";

import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import {
  POOLS,
  curveAbi,
  assimilatorAbi,
  type PoolConfig,
  type PoolId,
} from "@/config/contracts";

interface PoolTableProps {
  selected: PoolId;
  onSelect: (id: PoolId) => void;
}

export function PoolTable({ selected, onSelect }: PoolTableProps) {
  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr] gap-2 px-4 py-3 text-xs text-zinc-400 font-medium border-b border-zinc-800">
        <span>Pool</span>
        <span className="text-right">TVL</span>
        <span className="text-right">Oracle Rate</span>
        <span className="text-right">Composition</span>
      </div>

      {/* Rows */}
      {(Object.keys(POOLS) as PoolId[]).map((id) => (
        <PoolRow
          key={id}
          pool={POOLS[id]}
          isSelected={selected === id}
          onClick={() => onSelect(id)}
        />
      ))}
    </div>
  );
}

function PoolRow({
  pool,
  isSelected,
  onClick,
}: {
  pool: PoolConfig;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { data: liquidityData } = useReadContract({
    address: pool.curveAddress,
    abi: curveAbi,
    functionName: "liquidity",
  });

  const { data: oracleRate } = useReadContract({
    address: pool.baseAssimilatorAddress,
    abi: assimilatorAbi,
    functionName: "getRate",
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

  const basePct =
    baseLiq !== null && totalLiquidity !== null && totalLiquidity > 0
      ? (baseLiq / totalLiquidity) * 100
      : null;

  const quotePct =
    quoteLiq !== null && totalLiquidity !== null && totalLiquidity > 0
      ? (quoteLiq / totalLiquidity) * 100
      : null;

  const oracleFormatted = oracleRate
    ? (Number(oracleRate) / 1e8).toFixed(4)
    : null;

  const baseSymbol = pool.baseToken.symbol;
  const quoteSymbol = pool.quoteToken.symbol;

  return (
    <button
      onClick={onClick}
      className={`w-full grid grid-cols-[1.2fr_1fr_1fr_1.4fr] gap-2 px-4 py-3 text-sm transition-colors cursor-pointer ${
        isSelected
          ? "bg-zinc-800 border-l-2 border-indigo-500"
          : "hover:bg-zinc-800/50 border-l-2 border-transparent"
      }`}
    >
      <span className="text-left font-medium">{pool.name}</span>

      <span className="text-right">
        {totalLiquidity !== null
          ? `$${totalLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          : "..."}
      </span>

      <span className="text-right">
        {oracleFormatted ?? "..."}
      </span>

      <div className="flex items-center gap-2 justify-end">
        {basePct !== null && quotePct !== null ? (
          <>
            <span className="text-xs text-zinc-400 whitespace-nowrap">
              {basePct.toFixed(0)}% / {quotePct.toFixed(0)}%
            </span>
            <div className="w-16 h-2 rounded-full bg-zinc-700 overflow-hidden flex shrink-0">
              <div
                className="h-full bg-indigo-500 rounded-l-full"
                style={{ width: `${basePct}%` }}
              />
              <div
                className="h-full bg-emerald-500 rounded-r-full"
                style={{ width: `${quotePct}%` }}
              />
            </div>
          </>
        ) : (
          <span>...</span>
        )}
      </div>
    </button>
  );
}
