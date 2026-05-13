"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { curveAbi, erc20Abi, type PoolConfig } from "@/config/contracts";

const SLIPPAGE_BPS = 100; // 1% slippage for deposits
const DEADLINE_SECONDS = 300;

export function DepositForm({ pool }: { pool: PoolConfig }) {
  const { address, isConnected } = useAccount();
  const [usdInput, setUsdInput] = useState("");

  const baseToken = pool.baseToken;
  const quoteToken = pool.quoteToken;

  // Parse to 18 decimals (deposit() takes an 18-decimal USD value)
  const parsedDeposit =
    usdInput && Number(usdInput) > 0 ? parseUnits(usdInput, 18) : 0n;

  // Preview deposit
  const { data: depositPreview, isFetching: isPreviewing } = useReadContract({
    address: pool.curveAddress,
    abi: curveAbi,
    functionName: "viewDeposit",
    args: [parsedDeposit],
    query: { enabled: parsedDeposit > 0n },
  });

  const lpTokens = depositPreview ? depositPreview[0] : 0n;
  const requiredAmounts = depositPreview ? depositPreview[1] : [];
  const baseNeeded = requiredAmounts.length > 0 ? requiredAmounts[0] : 0n;
  const quoteNeeded = requiredAmounts.length > 1 ? requiredAmounts[1] : 0n;

  // User balances
  const { data: baseBalance } = useReadContract({
    address: baseToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: quoteBalance } = useReadContract({
    address: quoteToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Allowances
  const { data: baseAllowance, refetch: refetchBaseAllowance } =
    useReadContract({
      address: baseToken.address,
      abi: erc20Abi,
      functionName: "allowance",
      args: address ? [address, pool.curveAddress] : undefined,
      query: { enabled: !!address },
    });

  const { data: quoteAllowance, refetch: refetchQuoteAllowance } =
    useReadContract({
      address: quoteToken.address,
      abi: erc20Abi,
      functionName: "allowance",
      args: address ? [address, pool.curveAddress] : undefined,
      query: { enabled: !!address },
    });

  const needsBaseApproval =
    baseNeeded > 0n &&
    baseAllowance !== undefined &&
    baseAllowance < baseNeeded;
  const needsQuoteApproval =
    quoteNeeded > 0n &&
    quoteAllowance !== undefined &&
    quoteAllowance < quoteNeeded;

  const insufficientBase =
    baseNeeded > 0n && baseBalance !== undefined && baseBalance < baseNeeded;
  const insufficientQuote =
    quoteNeeded > 0n && quoteBalance !== undefined && quoteBalance < quoteNeeded;

  // Approve base token
  const {
    writeContract: approveBase,
    data: approveBaseHash,
    isPending: isApprovingBase,
    reset: resetApproveBase,
  } = useWriteContract();

  const { isLoading: isBaseApproveConfirming, isSuccess: baseApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveBaseHash });

  // Approve quote token
  const {
    writeContract: approveQuote,
    data: approveQuoteHash,
    isPending: isApprovingQuote,
    reset: resetApproveQuote,
  } = useWriteContract();

  const { isLoading: isQuoteApproveConfirming, isSuccess: quoteApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveQuoteHash });

  // Deposit
  const {
    writeContract: deposit,
    data: depositHash,
    isPending: isDepositing,
    reset: resetDeposit,
  } = useWriteContract();

  const { isLoading: isDepositConfirming, isSuccess: depositConfirmed } =
    useWaitForTransactionReceipt({ hash: depositHash });

  // Refetch allowances after approvals
  useEffect(() => {
    if (baseApproveConfirmed) refetchBaseAllowance();
  }, [baseApproveConfirmed, refetchBaseAllowance]);

  useEffect(() => {
    if (quoteApproveConfirmed) refetchQuoteAllowance();
  }, [quoteApproveConfirmed, refetchQuoteAllowance]);

  // Reset after deposit
  useEffect(() => {
    if (depositConfirmed) {
      setUsdInput("");
      resetDeposit();
      resetApproveBase();
      resetApproveQuote();
    }
  }, [depositConfirmed, resetDeposit, resetApproveBase, resetApproveQuote]);

  // Reset state when pool changes
  useEffect(() => {
    setUsdInput("");
    resetDeposit();
    resetApproveBase();
    resetApproveQuote();
  }, [pool.id, resetDeposit, resetApproveBase, resetApproveQuote]);

  const handleApproveBase = useCallback(() => {
    approveBase({
      address: baseToken.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [pool.curveAddress, maxUint256],
    });
  }, [approveBase, baseToken.address, pool.curveAddress]);

  const handleApproveQuote = useCallback(() => {
    approveQuote({
      address: quoteToken.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [pool.curveAddress, maxUint256],
    });
  }, [approveQuote, quoteToken.address, pool.curveAddress]);

  const handleDeposit = useCallback(() => {
    if (!parsedDeposit || !baseNeeded || !quoteNeeded) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
    // Slippage bounds: min = needed * (1 - slippage), max = needed * (1 + slippage)
    const minBase = (baseNeeded * BigInt(10000 - SLIPPAGE_BPS)) / 10000n;
    const maxBase = (baseNeeded * BigInt(10000 + SLIPPAGE_BPS)) / 10000n;
    const minQuote = (quoteNeeded * BigInt(10000 - SLIPPAGE_BPS)) / 10000n;
    const maxQuote = (quoteNeeded * BigInt(10000 + SLIPPAGE_BPS)) / 10000n;

    deposit({
      address: pool.curveAddress,
      abi: curveAbi,
      functionName: "deposit",
      args: [parsedDeposit, minQuote, minBase, maxQuote, maxBase, deadline],
    });
  }, [deposit, pool.curveAddress, parsedDeposit, baseNeeded, quoteNeeded]);

  const isBusy =
    isApprovingBase ||
    isBaseApproveConfirming ||
    isApprovingQuote ||
    isQuoteApproveConfirming ||
    isDepositing ||
    isDepositConfirming;

  const buttonLabel = !isConnected
    ? "Connect Wallet"
    : insufficientBase || insufficientQuote
      ? "Insufficient Balance"
      : isBusy
        ? isApprovingBase || isBaseApproveConfirming
          ? `Approving ${baseToken.symbol}...`
          : isApprovingQuote || isQuoteApproveConfirming
            ? `Approving ${quoteToken.symbol}...`
            : "Depositing..."
        : needsBaseApproval
          ? `Approve ${baseToken.symbol}`
          : needsQuoteApproval
            ? `Approve ${quoteToken.symbol}`
            : "Deposit";

  const buttonDisabled =
    !isConnected ||
    !parsedDeposit ||
    insufficientBase ||
    insufficientQuote ||
    isBusy;

  const handleClick = () => {
    if (needsBaseApproval) {
      handleApproveBase();
    } else if (needsQuoteApproval) {
      handleApproveQuote();
    } else {
      handleDeposit();
    }
  };

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
      <h2 className="text-lg font-semibold">Add Liquidity</h2>

      {/* USD amount input */}
      <div className="rounded-xl bg-zinc-800 p-4">
        <div className="text-sm text-zinc-400 mb-2">Deposit amount (USD)</div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={usdInput}
            onChange={(e) => {
              const v = e.target.value;
              if (/^[0-9]*\.?[0-9]*$/.test(v)) setUsdInput(v);
            }}
            className="flex-1 bg-transparent text-2xl font-medium outline-none text-white placeholder-zinc-600"
          />
          <span className="text-lg font-semibold text-zinc-300">USD</span>
        </div>
      </div>

      {/* Preview */}
      {parsedDeposit > 0n && (
        <div className="rounded-xl bg-zinc-800 p-4 space-y-2">
          <div className="text-sm text-zinc-400">Deposit Preview</div>
          {isPreviewing ? (
            <div className="text-zinc-500">Loading...</div>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">LP tokens to receive</span>
                <span className="font-medium">
                  {Number(formatUnits(lpTokens, 18)).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">{baseToken.symbol} required</span>
                <span className="font-medium">
                  {Number(formatUnits(baseNeeded, baseToken.decimals)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">{quoteToken.symbol} required</span>
                <span className="font-medium">
                  {Number(formatUnits(quoteNeeded, quoteToken.decimals)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* User balances */}
      {address && (
        <div className="text-sm text-zinc-400 px-1 space-y-1">
          <div className="flex justify-between">
            <span>Your {baseToken.symbol}</span>
            <span>
              {baseBalance !== undefined
                ? Number(formatUnits(baseBalance, baseToken.decimals)).toFixed(2)
                : "..."}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Your {quoteToken.symbol}</span>
            <span>
              {quoteBalance !== undefined
                ? Number(formatUnits(quoteBalance, quoteToken.decimals)).toFixed(2)
                : "..."}
            </span>
          </div>
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
      {depositConfirmed && depositHash && (
        <div className="text-center text-sm text-green-400">
          Deposit confirmed!{" "}
          <a
            href={`https://basescan.org/tx/${depositHash}`}
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
