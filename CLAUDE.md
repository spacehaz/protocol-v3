# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DFX Protocol V3 — a Solidity-based decentralized foreign exchange AMM optimized for stablecoin and ERC20 token pairs. Built with Foundry, targeting Ethereum mainnet, Polygon, and Arbitrum. Solidity version: 0.8.13.

## Build & Test Commands

```bash
# Install dependencies (git submodules)
forge install

# Build
forge build

# Format
forge fmt

# Run tests (requires a forked chain — see below)
# Option A: Start a local fork in one terminal, then run tests against it
anvil -f https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY} --fork-block-number 44073000
forge test --match-contract V3Test -vvv -f http://127.0.0.1:8545

# Option B: Run tests directly against a remote fork (used in CI)
forge test --optimize --optimizer-runs 1000000 -v \
  -f https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY} \
  --fork-block-number 15129966

# Run a specific test contract
forge test --match-contract <ContractName> -vvv -f <rpc_url>

# Run a specific test function
forge test --match-test <testFunctionName> -vvv -f <rpc_url>
```

Tests require a forked mainnet RPC endpoint (Alchemy/Infura). The main test suites are `V3Test` (Universal.t.sol, Polygon fork) and `DepositTest` (PolygonDeployed.t.sol).

## Deployment

```bash
forge script script/MainnetDeployment.s.sol --rpc-url $MAINNET_RPC_URL --broadcast
forge script script/PolygonDeployment.s.sol --rpc-url $POLYGON_RPC_URL --broadcast
forge script script/ArbitrumDeployment.s.sol --rpc-url $ARBITRUM_RPC_URL --broadcast
```

Deployment order: Config → AssimilatorFactory → CurveFactoryV3 → link factory → create curves with parameters → Router → Zap. Network-specific addresses and curve parameters are in `script/Addresses.sol` and `script/CurveParams.sol`.

## Architecture

### Core Flow

```
User → Router (multi-hop) or Curve (direct) → Assimilators (price normalization) → CurveMath (bonding curve) → token transfer
```

### Key Components

**Assimilators** (`src/assimilators/AssimilatorV3.sol`, `src/AssimilatorFactory.sol`): Normalize token amounts to a common "numeraire" (USD value) using Chainlink oracle price feeds. Each token pair gets its own assimilator instance deployed by the factory. Handles decimal differences between tokens.

**Curve** (`src/Curve.sol`): The main AMM pool contract — handles swaps, proportional deposits/withdrawals, flash loans, and is itself an ERC20 (LP token). Each Curve is a 50/50 weighted pair. Created by CurveFactoryV3.

**Curve Parameters** (set via `src/Orchestrator.sol`):
- **Alpha** — max/min reserve allocation boundaries
- **Beta** — liquidity depth (flattens curve near oracle price)
- **Delta** — slippage when pool deviates from oracle price
- **Epsilon** — fixed swap fee
- **Lambda** — dynamic fee for slippage (constrained to 1e18 in V3)

Math is based on the [Shell Protocol whitepaper](https://github.com/cowri/shell-solidity-v1/blob/master/Shell_White_Paper_v1.0.pdf).

**Swaps** (`src/Swaps.sol`): Swap execution logic with fee calculation, used as a library by Curve.

**ProportionalLiquidity** (`src/ProportionalLiquidity.sol`): Deposit/withdrawal logic that respects existing LP ratio.

**Router** (`src/Router.sol`): Multi-hop swap routing through multiple curves, with ETH wrapping/unwrapping support.

**Zap** (`src/Zap.sol`): Single-token liquidity provision — automatically swaps to match pool ratio for deposit, or converts back to single token on withdrawal.

**Config** (`src/Config.sol`): Protocol-wide settings — fee percentages, treasury address, frozen state. Uses ReentrancyGuard.

### Math Libraries (`src/lib/`)

All curve math uses ABDK 64x64 fixed-point arithmetic (`int128`). Key files: `ABDKMath64x64.sol`, `UnsafeMath64x64.sol`, `FullMath.sol`.

### Dependencies

- OpenZeppelin v3.3.0 (ERC20, SafeERC20, Ownable, ReentrancyGuard)
- ABDK Math v2.4
- forge-std (testing)

Import remappings: `@openzeppelin/` → `lib/openzeppelin-contracts/`, `@forge-std/` → `lib/forge-std/src/`.

## Conventions

- Library-heavy architecture: Orchestrator, Swaps, ProportionalLiquidity, CurveMath, Assimilators are all Solidity libraries called via delegatecall or direct use.
- Error message prefix convention: `"Curve/..."`, `"CurveFactory/..."`, `"Router/..."`, etc.
- All pools quote against USDC. Oracle prices are USD-denominated via Chainlink.
- Optimizer is enabled at 200 runs (foundry.toml default).
