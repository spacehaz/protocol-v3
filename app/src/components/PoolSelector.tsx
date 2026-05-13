"use client";

import { POOLS, type PoolId } from "@/config/contracts";

interface PoolSelectorProps {
  selected: PoolId;
  onChange: (id: PoolId) => void;
}

export function PoolSelector({ selected, onChange }: PoolSelectorProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-zinc-900 p-1 w-full max-w-md">
      {(Object.keys(POOLS) as PoolId[]).map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            selected === id
              ? "bg-zinc-700 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          {POOLS[id].name}
        </button>
      ))}
    </div>
  );
}
