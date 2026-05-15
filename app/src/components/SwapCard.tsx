"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { BFX } from "bfx-sdk";
import { curveAbi, erc20Abi, type PoolConfig } from "@/config/contracts";
import { type Token } from "@/config/tokens";

const SLIPPAGE_BPS = 50; // 0.5%
const DEADLINE_SECONDS = 300; // 5 min

export function SwapCard({ pool }: { pool: PoolConfig }) {
  const { address, isConnected } = useAccount();
  const [inputAmount, setInputAmount] = useState("");
  const [direction, setDirection] = useState<"base-quote" | "quote-base">(
    "base-quote"
  );

  const fromToken: Token = direction === "base-quote" ? pool.baseToken : pool.quoteToken;
  const toToken: Token = direction === "base-quote" ? pool.quoteToken : pool.baseToken;

  const parsedInput =
    inputAmount && Number(inputAmount) > 0
      ? parseUnits(inputAmount, fromToken.decimals)
      : 0n;

  // Read user's balance of input token
  const { data: userBalance } = useReadContract({
    address: fromToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: fromToken.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, pool.curveAddress] : undefined,
    query: { enabled: !!address },
  });

  // Preview swap output
  const { data: previewOutput, isFetching: isPreviewing } = useReadContract({
    address: pool.curveAddress,
    abi: curveAbi,
    functionName: "viewOriginSwap",
    args: [fromToken.address, toToken.address, parsedInput],
    query: { enabled: parsedInput > 0n },
  });

  const outputFormatted = previewOutput
    ? formatUnits(previewOutput, toToken.decimals)
    : "";

  const minOutput = previewOutput
    ? (previewOutput * BigInt(10000 - SLIPPAGE_BPS)) / 10000n
    : 0n;

  const rate =
    previewOutput && parsedInput > 0n
      ? (
          Number(formatUnits(previewOutput, toToken.decimals)) /
          Number(inputAmount)
        ).toFixed(6)
      : null;

  // Contract call timing — track isFetching transitions
  const [contractCallMs, setContractCallMs] = useState<number | null>(null);
  const fetchStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (parsedInput <= 0n) {
      setContractCallMs(null);
      fetchStartRef.current = null;
      return;
    }
    if (isPreviewing && fetchStartRef.current === null) {
      fetchStartRef.current = Date.now();
    } else if (!isPreviewing && fetchStartRef.current !== null) {
      setContractCallMs(Date.now() - fetchStartRef.current);
      fetchStartRef.current = null;
    }
  }, [isPreviewing, parsedInput]);

  // SDK (bfx-sdk) off-chain quote with timing
  const bfxRef = useRef<BFX | null>(null);
  const [bfxReady, setBfxReady] = useState(false);
  const [sdkRate, setSdkRate] = useState<string | null>(null);
  const [sdkCallMs, setSdkCallMs] = useState<number | null>(null);
  const [oracleRateFormatted, setOracleRateFormatted] = useState<string | null>(null);

  useEffect(() => {
    setBfxReady(false);
    setSdkRate(null);
    setSdkCallMs(null);
    setOracleRateFormatted(null);
    const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
    let cancelled = false;
    const bfx = new BFX(rpcUrl);
    let intervalId: ReturnType<typeof setInterval> | null = null;
    bfx.loadPoolState(pool.baseToken.address, pool.quoteToken.address).then(() => {
      if (!cancelled) {
        bfxRef.current = bfx;
        const state = bfx.getState();
        const price = Number(state.tokenAOraclePrice) / 10 ** state.oracleDecimals;
        setOracleRateFormatted(price.toFixed(4));
        setBfxReady(true);
        intervalId = setInterval(() => {
          const s = bfxRef.current?.getState();
          if (s) console.log("[bfx pool state]", s);
        }, 5000);
      } else {
        bfx.stop();
      }
    });
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      bfxRef.current?.stop();
      bfxRef.current = null;
    };
  }, [pool.curveAddress, pool.baseToken.address, pool.quoteToken.address]);

  useEffect(() => {
    if (parsedInput <= 0n || !bfxReady || !bfxRef.current) {
      setSdkRate(null);
      setSdkCallMs(null);
      return;
    }
    const start = performance.now();
    try {
      const result = bfxRef.current.quote(fromToken.address, toToken.address, parsedInput);
      const elapsed = performance.now() - start;
      setSdkCallMs(elapsed);
      setSdkRate(
        (Number(formatUnits(result.amountOut, toToken.decimals)) / Number(inputAmount)).toFixed(6)
      );
    } catch {
      setSdkRate(null);
      setSdkCallMs(null);
    }
  }, [parsedInput, bfxReady, fromToken.address, toToken.address, toToken.decimals, inputAmount]);

  const needsApproval =
    parsedInput > 0n && allowance !== undefined && allowance < parsedInput;

  const insufficientBalance =
    parsedInput > 0n && userBalance !== undefined && userBalance < parsedInput;

  // Write: approve
  const {
    writeContract: approve,
    data: approveTxHash,
    isPending: isApproving,
    reset: resetApprove,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTxHash });

  // Swap: SDK path (bfx-sdk buildSwap → raw tx)
  const {
    sendTransaction: sendSdkSwap,
    data: sdkSwapTxHash,
    isPending: isSdkSwapping,
    reset: resetSdkSwap,
  } = useSendTransaction();

  // Swap: contract fallback (when SDK not yet ready)
  const {
    writeContract: sendContractSwap,
    data: contractSwapTxHash,
    isPending: isContractSwapping,
    reset: resetContractSwap,
  } = useWriteContract();

  const swapTxHash = sdkSwapTxHash ?? contractSwapTxHash;
  const isSwapping = isSdkSwapping || isContractSwapping;
  const resetSwap = useCallback(() => {
    resetSdkSwap();
    resetContractSwap();
  }, [resetSdkSwap, resetContractSwap]);

  const { isLoading: isSwapConfirming, isSuccess: isSwapConfirmed } =
    useWaitForTransactionReceipt({ hash: swapTxHash });

  // After approval confirmed, refetch allowance
  useEffect(() => {
    if (isApproveConfirmed) {
      refetchAllowance();
    }
  }, [isApproveConfirmed, refetchAllowance]);

  // Reset after swap confirmed
  useEffect(() => {
    if (isSwapConfirmed) {
      setInputAmount("");
      resetSwap();
      resetApprove();
    }
  }, [isSwapConfirmed, resetSwap, resetApprove]);

  // Reset state when pool changes
  useEffect(() => {
    setInputAmount("");
    setDirection("base-quote");
    setContractCallMs(null);
    resetSwap();
    resetApprove();
  }, [pool.id, resetSwap, resetApprove]);

  const handleApprove = useCallback(() => {
    approve({
      address: fromToken.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [pool.curveAddress, maxUint256],
    });
  }, [approve, fromToken.address, pool.curveAddress]);

  const handleSdkSwap = useCallback(() => {
    if (!parsedInput || !minOutput || !bfxReady || !bfxRef.current || !address) return;
    const deadline = Math.floor(Date.now() / 1000) + DEADLINE_SECONDS;
    const tx = bfxRef.current.buildSwap({
      tokenIn: fromToken.address,
      tokenOut: toToken.address,
      amountIn: parsedInput,
      minAmountOut: minOutput,
      recipient: address,
      deadline,
    });
    sendSdkSwap({ to: tx.to, data: tx.data, value: tx.value });
  }, [bfxReady, address, sendSdkSwap, fromToken.address, toToken.address, parsedInput, minOutput]);

  const handleContractSwap = useCallback(() => {
    if (!parsedInput || !minOutput) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
    sendContractSwap({
      address: pool.curveAddress,
      abi: curveAbi,
      functionName: "originSwap",
      args: [fromToken.address, toToken.address, parsedInput, minOutput, deadline],
    });
  }, [sendContractSwap, pool.curveAddress, fromToken.address, toToken.address, parsedInput, minOutput]);

  const toggleDirection = () => {
    setDirection((d) => (d === "base-quote" ? "quote-base" : "base-quote"));
    setInputAmount("");
    resetSwap();
    resetApprove();
  };

  const isBusy =
    isApproving || isApproveConfirming || isSwapping || isSwapConfirming;

  const baseSwapDisabled =
    !isConnected || !parsedInput || insufficientBalance || isBusy || !previewOutput;

  const sdkSwapDisabled = baseSwapDisabled || !bfxReady || !address;
  const contractSwapDisabled = baseSwapDisabled;

  return (
    <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-2">
      <h2 className="text-lg font-semibold mb-3">Swap</h2>

      {/* From */}
      <div className="rounded-xl bg-zinc-800 p-4">
        <div className="flex justify-between text-sm text-zinc-400 mb-2">
          <span>From</span>
          {address && userBalance !== undefined && (
            <span>
              Balance: {Number(formatUnits(userBalance, fromToken.decimals)).toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={inputAmount}
            onChange={(e) => {
              const v = e.target.value;
              if (/^[0-9]*\.?[0-9]*$/.test(v)) setInputAmount(v);
            }}
            className="flex-1 bg-transparent text-2xl font-medium outline-none text-white placeholder-zinc-600"
          />
          <span className="text-lg font-semibold text-zinc-300">
            {fromToken.symbol}
          </span>
        </div>
      </div>

      {/* Toggle direction */}
      <div className="flex justify-center -my-1 relative z-10">
        <button
          onClick={toggleDirection}
          className="bg-zinc-800 border border-zinc-700 rounded-lg p-2 hover:bg-zinc-700 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="text-zinc-300"
          >
            <path
              d="M8 1v14m0 0l-4-4m4 4l4-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* To */}
      <div className="rounded-xl bg-zinc-800 p-4">
        <div className="text-sm text-zinc-400 mb-2">To</div>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-2xl font-medium text-white">
            {isPreviewing ? (
              <span className="text-zinc-500">Loading...</span>
            ) : outputFormatted ? (
              Number(outputFormatted).toFixed(toToken.decimals > 2 ? 6 : 2)
            ) : (
              <span className="text-zinc-600">0.00</span>
            )}
          </div>
          <span className="text-lg font-semibold text-zinc-300">
            {toToken.symbol}
          </span>
        </div>
      </div>

      {/* Rate info */}
      {rate && (
        <div className="text-sm text-zinc-400 px-1 space-y-1">
          <div className="flex justify-between">
            <span>Rate (Contract call)</span>
            <span>
              1 {fromToken.symbol} = {rate} {toToken.symbol}
              {contractCallMs !== null && (
                <span className="text-zinc-500 ml-1">({contractCallMs}ms)</span>
              )}
            </span>
          </div>
          {sdkRate && (
            <div className="flex justify-between">
              <span>Rate (SDK call)</span>
              <span>
                1 {fromToken.symbol} = {sdkRate} {toToken.symbol}
                {sdkCallMs !== null && (
                  <span className="text-zinc-500 ml-1">
                    ({sdkCallMs < 1 ? sdkCallMs.toFixed(2) : Math.round(sdkCallMs)}ms)
                  </span>
                )}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Min received</span>
            <span>
              {Number(formatUnits(minOutput, toToken.decimals)).toFixed(toToken.decimals > 2 ? 6 : 2)}{" "}
              {toToken.symbol}
            </span>
          </div>
          {oracleRateFormatted && (
            <div className="flex justify-between">
              <span>Oracle</span>
              <span>1 {pool.baseToken.symbol} = {oracleRateFormatted} USD</span>
            </div>
          )}
        </div>
      )}

      {/* Approve or swap buttons */}
      {needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={!isConnected || isBusy}
          className="w-full py-4 rounded-xl font-semibold text-lg transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed"
        >
          {isApproving || isApproveConfirming ? "Approving..." : `Approve ${fromToken.symbol}`}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSdkSwap}
            disabled={sdkSwapDisabled}
            className="py-4 rounded-xl font-semibold text-base transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed"
          >
            {isSdkSwapping || (isSwapConfirming && sdkSwapTxHash)
              ? "Swapping..."
              : insufficientBalance
                ? "Insufficient"
                : !bfxReady
                  ? "SDK loading..."
                  : "Swap (SDK)"}
          </button>
          <button
            onClick={handleContractSwap}
            disabled={contractSwapDisabled}
            className="py-4 rounded-xl font-semibold text-base transition-colors bg-violet-700 hover:bg-violet-600 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed"
          >
            {isContractSwapping || (isSwapConfirming && contractSwapTxHash)
              ? "Swapping..."
              : insufficientBalance
                ? "Insufficient"
                : "Swap (Contract)"}
          </button>
        </div>
      )}

      {/* Tx success */}
      {isSwapConfirmed && swapTxHash && (
        <div className="text-center text-sm text-green-400">
          Swap confirmed!{" "}
          <a
            href={`https://basescan.org/tx/${swapTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View on BaseScan
          </a>
        </div>
      )}
    </div>
  );
}
