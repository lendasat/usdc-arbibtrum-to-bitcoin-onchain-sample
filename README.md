# USDC to Bitcoin PoC

A CLI proof-of-concept for [LendaSwap](https://docs.satora.io/) that performs **gasless USDC (Arbitrum) to Bitcoin
on-chain** atomic swaps, and **Bitcoin on-chain to USDC (Arbitrum)** swaps.

The user never pays EVM gas fees. All EVM transactions are submitted by the LendaSwap relay server
using [Permit2](https://github.com/Uniswap/permit2) signatures.

## How it works

1. A BIP39 mnemonic is generated on first run (or loaded from `.env`)
2. An EVM address is derived from the mnemonic -- this is your **internal wallet**
3. You send USDC to the internal wallet on Arbitrum
4. The CLI creates a swap, signs a Permit2 message off-chain, and the server funds the EVM HTLC (gasless)
5. The server locks BTC in a Taproot HTLC on Bitcoin
6. The CLI claims the BTC by revealing the preimage (0-conf, no need to wait for confirmation)

```
You (USDC on Arbitrum) --> EVM HTLC --> Server claims USDC
Server (BTC on Bitcoin) --> BTC HTLC --> You claim BTC
```

## Prerequisites

- Node.js >= 22
- USDC on Arbitrum

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your mnemonic, or leave it to auto-generate on first run
```

## Usage

```bash
# Show your internal wallet address and USDC balance
npm start -- address

# Create a swap: send 100 USDC to receive BTC on-chain
npm start -- swap usdc-to-btc create 100 bc1q...

# With custom Bitcoin fee rate (default: 1 sat/vB)
npm start -- swap usdc-to-btc create 100 bc1q... 5

# Resume a USDC -> BTC swap
npm start -- swap usdc-to-btc continue <swap-id>

# Create a swap: send BTC on-chain to receive USDC on Arbitrum
npm start -- swap btc-to-usdc create 150000 0xAbCd...

# Resume a BTC -> USDC swap
npm start -- swap btc-to-usdc continue <swap-id>

# List all stored swaps
npm start -- list

# Check swap status
npm start -- status <swap-id>

# Refund a swap
npm start -- refund <swap-id>

# Recover swaps from server (useful after restoring from mnemonic)
npm start -- recover
```

## USDC -> BTC flow

```
$ npm start -- swap usdc-to-btc create 100 bc1qMyBitcoinAddress

--- LendaSwap: USDC (Arbitrum) -> BTC On-chain ---
USDC amount: 100
Bitcoin destination: bc1qMyBitcoinAddress
Your deposit address: 0xAbCd...

Checking USDC balance on Arbitrum...
Current balance: 100.0 USDC

Funds available. Creating swap...
Swap created: a1b2c3d4-...
You will receive: ~145000 sats

Initiating gasless funding...
Swap funded. TX: 0x...

Waiting for Bitcoin to be locked...
Bitcoin locked by server.

Claiming Bitcoin (0-conf)...

=== Swap Complete ===

--- Swap Status ---
  ID:        a1b2c3d4-...
  Status:    clientredeemed
  Source:    100.0 USDC
  Target:    145000 sats
  BTC Claim: abc123...
```

## BTC -> USDC flow

```
$ npm start -- swap btc-to-usdc create 150000 0xAbCdMyArbitrumAddress

--- LendaSwap: BTC On-chain -> USDC (Arbitrum) ---
BTC amount: 150000 sats
USDC destination: 0xAbCdMyArbitrumAddress

Fetching quote...

--- Quote ---
  You send:       150000 sats
  You receive:    ~123.45 USDC

Creating swap...
Swap created: a1b2c3d4-...
Send exactly 150000 sats to: bc1p...
Expected USDC: ~123.45 USDC

Waiting for BTC deposit...
BTC deposit detected.

Waiting for USDC to be funded on Arbitrum...
USDC funded by server.

Claiming USDC on Arbitrum...

=== Swap Complete ===
```

## Refunds

If a swap fails, use the `refund` command:

```bash
npm start -- refund <swap-id>
```

This performs a **collaborative gasless refund** -- the server cosigns and submits the refund transaction, so you don't
need to wait for the HTLC timelock to expire and you don't pay gas.

**Important:** Refunded funds are returned to the **internal wallet** (the EVM address derived from your mnemonic), *
*not** to the original wallet that sent the USDC. You can check the internal wallet balance with `npm start -- address`
and transfer the funds out manually.

## Recovery

All swap state is persisted in a local SQLite database (`lendaswap.db`). If you lose the database but still have your
mnemonic, you can recover swap history from the server:

```bash
npm start -- recover
```

## Configuration

See [`.env.example`](.env.example) for available configuration options:

- `MNEMONIC` -- BIP39 seed phrase (auto-generated if not set)
- `API_KEY` -- Optional LendaSwap API key
- `DEBUG` -- Enable verbose error output
