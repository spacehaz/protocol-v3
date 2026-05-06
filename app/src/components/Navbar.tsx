"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-xl font-bold text-white">
          DFX
        </Link>
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
          <Link
            href="/swap"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname === "/swap"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Swap
          </Link>
          <Link
            href="/pool"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname === "/pool"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Pool
          </Link>
        </div>
      </div>
      <ConnectButton />
    </nav>
  );
}
