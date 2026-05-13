"use client";

import { useState } from "react";
import { SwapCard } from "@/components/SwapCard";
import { PoolSelector } from "@/components/PoolSelector";
import { POOLS, DEFAULT_POOL_ID, type PoolId } from "@/config/contracts";

export default function SwapPage() {
  const [poolId, setPoolId] = useState<PoolId>(DEFAULT_POOL_ID);

  return (
    <div className="flex flex-col items-center gap-4">
      <PoolSelector selected={poolId} onChange={setPoolId} />
      <SwapCard pool={POOLS[poolId]} />
    </div>
  );
}
