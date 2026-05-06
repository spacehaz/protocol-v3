"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { CURVE_ADDRESS, curveAbi, erc20Abi } from "@/config/contracts";
import { EURC, USDC } from "@/config/tokens";

const SLIPPAGE_BPS = 100; // 1% slippage for deposits
const DEADLINE_SECONDS = 300;

export function DepositForm() {
  const { address, isConnected } = useAccount();
  const [usdInput, setUsdInput] = useState("");

  // Parse to 18 decimals (deposit() takes an 18-decimal USD value)
  const parsedDeposit =
    usdInput && Number(usdInput) > 0 ? parseUnits(usdInput, 18) : 0n;

  // Preview deposit
  const { data: depositPreview, isFetching: isPreviewing } = useReadContract({
    address: CURVE_ADDRESS,
    abi: curveAbi,
    functionName: "viewDeposit",
    args: [parsedDeposit],
    query: { enabled: parsedDeposit > 0n },
  });

  const lpTokens = depositPreview ? depositPreview[0] : 0n;
  const requiredAmounts = depositPreview ? depositPreview[1] : [];
  const eurcNeeded = requiredAmounts.length > 0 ? requiredAmounts[0] : 0n;
  const usdcNeeded = requiredAmounts.length > 1 ? requiredAmounts[1] : 0n;

  // User balances
  const { data: eurcBalance } = useReadContract({
    address: EURC.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: usdcBalance } = useReadContract({
    address: USDC.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Allowances
  const { data: eurcAllowance, refetch: refetchEurcAllowance } =
    useReadContract({
      address: EURC.address,
      abi: erc20Abi,
      functionName: "allowance",
      args: address ? [address, CURVE_ADDRESS] : undefined,
      query: { enabled: !!address },
    });

  const { data: usdcAllowance, refetch: refetchUsdcAllowance } =
    useReadContract({
      address: USDC.address,
      abi: erc20Abi,
      functionName: "allowance",
      args: address ? [address, CURVE_ADDRESS] : undefined,
      query: { enabled: !!address },
    });

  const needsEurcApproval =
    eurcNeeded > 0n &&
    eurcAllowance !== undefined &&
    eurcAllowance < eurcNeeded;
  const needsUsdcApproval =
    usdcNeeded > 0n &&
    usdcAllowance !== undefined &&
    usdcAllowance < usdcNeeded;

  const insufficientEurc =
    eurcNeeded > 0n && eurcBalance !== undefined && eurcBalance < eurcNeeded;
  const insufficientUsdc =
    usdcNeeded > 0n && usdcBalance !== undefined && usdcBalance < usdcNeeded;

  // Approve EURC
  const {
    writeContract: approveEurc,
    data: approveEurcHash,
    isPending: isApprovingEurc,
    reset: resetApproveEurc,
  } = useWriteContract();

  const { isLoading: isEurcApproveConfirming, isSuccess: eurcApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveEurcHash });

  // Approve USDC
  const {
    writeContract: approveUsdc,
    data: approveUsdcHash,
    isPending: isApprovingUsdc,
    reset: resetApproveUsdc,
  } = useWriteContract();

  const { isLoading: isUsdcApproveConfirming, isSuccess: usdcApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveUsdcHash });

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
    if (eurcApproveConfirmed) refetchEurcAllowance();
  }, [eurcApproveConfirmed, refetchEurcAllowance]);

  useEffect(() => {
    if (usdcApproveConfirmed) refetchUsdcAllowance();
  }, [usdcApproveConfirmed, refetchUsdcAllowance]);

  // Reset after deposit
  useEffect(() => {
    if (depositConfirmed) {
      setUsdInput("");
      resetDeposit();
      resetApproveEurc();
      resetApproveUsdc();
    }
  }, [depositConfirmed, resetDeposit, resetApproveEurc, resetApproveUsdc]);

  const handleApproveEurc = useCallback(() => {
    approveEurc({
      address: EURC.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [CURVE_ADDRESS, maxUint256],
    });
  }, [approveEurc]);

  const handleApproveUsdc = useCallback(() => {
    approveUsdc({
      address: USDC.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [CURVE_ADDRESS, maxUint256],
    });
  }, [approveUsdc]);

  const handleDeposit = useCallback(() => {
    if (!parsedDeposit || !eurcNeeded || !usdcNeeded) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
    // Slippage bounds: min = needed * (1 - slippage), max = needed * (1 + slippage)
    const minEurc = (eurcNeeded * BigInt(10000 - SLIPPAGE_BPS)) / 10000n;
    const maxEurc = (eurcNeeded * BigInt(10000 + SLIPPAGE_BPS)) / 10000n;
    const minUsdc = (usdcNeeded * BigInt(10000 - SLIPPAGE_BPS)) / 10000n;
    const maxUsdc = (usdcNeeded * BigInt(10000 + SLIPPAGE_BPS)) / 10000n;

    deposit({
      address: CURVE_ADDRESS,
      abi: curveAbi,
      functionName: "deposit",
      args: [parsedDeposit, minUsdc, minEurc, maxUsdc, maxEurc, deadline],
    });
  }, [deposit, parsedDeposit, eurcNeeded, usdcNeeded]);

  const isBusy =
    isApprovingEurc ||
    isEurcApproveConfirming ||
    isApprovingUsdc ||
    isUsdcApproveConfirming ||
    isDepositing ||
    isDepositConfirming;

  const buttonLabel = !isConnected
    ? "Connect Wallet"
    : insufficientEurc || insufficientUsdc
      ? "Insufficient Balance"
      : isBusy
        ? isApprovingEurc || isEurcApproveConfirming
          ? "Approving EURC..."
          : isApprovingUsdc || isUsdcApproveConfirming
            ? "Approving USDC..."
            : "Depositing..."
        : needsEurcApproval
          ? "Approve EURC"
          : needsUsdcApproval
            ? "Approve USDC"
            : "Deposit";

  const buttonDisabled =
    !isConnected ||
    !parsedDeposit ||
    insufficientEurc ||
    insufficientUsdc ||
    isBusy;

  const handleClick = () => {
    if (needsEurcApproval) {
      handleApproveEurc();
    } else if (needsUsdcApproval) {
      handleApproveUsdc();
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
                <span className="text-zinc-400">EURC required</span>
                <span className="font-medium">
                  {Number(formatUnits(eurcNeeded, EURC.decimals)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">USDC required</span>
                <span className="font-medium">
                  {Number(formatUnits(usdcNeeded, USDC.decimals)).toLocaleString(
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
            <span>Your EURC</span>
            <span>
              {eurcBalance !== undefined
                ? Number(formatUnits(eurcBalance, EURC.decimals)).toFixed(2)
                : "..."}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Your USDC</span>
            <span>
              {usdcBalance !== undefined
                ? Number(formatUnits(usdcBalance, USDC.decimals)).toFixed(2)
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
