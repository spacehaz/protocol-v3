"use client";

import { useState } from "react";
import { PoolInfo } from "@/components/PoolInfo";
import { DepositForm } from "@/components/DepositForm";
import { PoolTable } from "@/components/PoolTable";
import { POOLS, DEFAULT_POOL_ID, type PoolId } from "@/config/contracts";

export default function PoolPage() {
  const [poolId, setPoolId] = useState<PoolId>(DEFAULT_POOL_ID);
  const pool = POOLS[poolId];

  return (
    <div className="w-full max-w-2xl space-y-4">
      <PoolTable selected={poolId} onSelect={setPoolId} />
      <PoolInfo pool={pool} />
      <DepositForm pool={pool} />
    </div>
  );
}
