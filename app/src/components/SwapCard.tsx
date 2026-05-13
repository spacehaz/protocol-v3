"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { curveAbi, erc20Abi, assimilatorAbi, type PoolConfig } from "@/config/contracts";
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

  // Oracle rate from base assimilator (8 decimals)
  const { data: oracleRate } = useReadContract({
    address: pool.baseAssimilatorAddress,
    abi: assimilatorAbi,
    functionName: "getRate",
  });

  const oracleRateFormatted = oracleRate
    ? (Number(oracleRate) / 1e8).toFixed(4)
    : null;

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

  // Write: swap
  const {
    writeContract: swap,
    data: swapTxHash,
    isPending: isSwapping,
    reset: resetSwap,
  } = useWriteContract();

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

  const handleSwap = useCallback(() => {
    if (!parsedInput || !minOutput) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
    swap({
      address: pool.curveAddress,
      abi: curveAbi,
      functionName: "originSwap",
      args: [fromToken.address, toToken.address, parsedInput, minOutput, deadline],
    });
  }, [swap, pool.curveAddress, fromToken.address, toToken.address, parsedInput, minOutput]);

  const toggleDirection = () => {
    setDirection((d) => (d === "base-quote" ? "quote-base" : "base-quote"));
    setInputAmount("");
    resetSwap();
    resetApprove();
  };

  const isBusy =
    isApproving || isApproveConfirming || isSwapping || isSwapConfirming;

  const buttonLabel = !isConnected
    ? "Connect Wallet"
    : insufficientBalance
      ? "Insufficient Balance"
      : isBusy
        ? isApproving || isApproveConfirming
          ? "Approving..."
          : "Swapping..."
        : needsApproval
          ? `Approve ${fromToken.symbol}`
          : "Swap";

  const buttonDisabled =
    !isConnected ||
    !parsedInput ||
    insufficientBalance ||
    isBusy ||
    (!needsApproval && !previewOutput);

  const handleClick = () => {
    if (needsApproval) {
      handleApprove();
    } else {
      handleSwap();
    }
  };

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
            <span>Rate</span>
            <span>
              1 {fromToken.symbol} = {rate} {toToken.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Min received</span>
            <span>
              {Number(formatUnits(minOutput, toToken.decimals)).toFixed(2)}{" "}
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

      {/* Action button */}
      <button
        onClick={handleClick}
        disabled={buttonDisabled}
        className="w-full py-4 rounded-xl font-semibold text-lg transition-colors bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed"
      >
        {buttonLabel}
      </button>

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
