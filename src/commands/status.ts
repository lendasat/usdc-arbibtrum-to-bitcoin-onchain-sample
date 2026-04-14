import { formatUsdc } from "../balance.js";
import type {
  BitcoinToEvmSwap,
  EvmToBtcSwap,
  SupportedSwap,
} from "../client.js";
import { buildClient } from "../client.js";

const ARBISCAN_ADDRESS = "https://arbiscan.io/address/";
const ARBISCAN_TX = "https://arbiscan.io/tx/";
const MEMPOOL_TX = "https://mempool.space/tx/";
const MEMPOOL_ADDR = "https://mempool.space/address/";

function printEvmToBitcoinStatus(swap: EvmToBtcSwap) {
  console.log(`\n--- Swap Status ---`);
  console.log(`  ID:        ${swap.id}`);
  console.log(`  Direction: ${swap.direction}`);
  console.log(`  Status:    ${swap.status}`);
  console.log(`  Source:    ${formatUsdc(BigInt(swap.source_amount))} USDC`);
  console.log(`  Target:    ${swap.target_amount} sats`);
  console.log(`  BTC HTLC:  ${MEMPOOL_ADDR}${swap.btc_htlc_address}`);
  console.log(`  EVM HTLC:  ${ARBISCAN_ADDRESS}${swap.evm_htlc_address}`);
  if (swap.evm_fund_txid) {
    console.log(`  EVM Fund:  ${ARBISCAN_TX}${swap.evm_fund_txid}`);
  }
  if (swap.evm_claim_txid) {
    console.log(`  EVM Claim: ${ARBISCAN_TX}${swap.evm_claim_txid}`);
  }
  if (swap.btc_fund_txid) {
    console.log(`  BTC Fund:  ${MEMPOOL_TX}${swap.btc_fund_txid}`);
  }
  if (swap.btc_claim_txid) {
    console.log(`  BTC Claim: ${MEMPOOL_TX}${swap.btc_claim_txid}`);
  }
}

function printBitcoinToEvmStatus(swap: BitcoinToEvmSwap) {
  console.log(`\n--- Swap Status ---`);
  console.log(`  ID:        ${swap.id}`);
  console.log(`  Direction: ${swap.direction}`);
  console.log(`  Status:    ${swap.status}`);
  console.log(`  Source:    ${swap.source_amount} sats`);
  console.log(`  Target:    ${formatUsdc(BigInt(swap.target_amount))} USDC`);
  console.log(`  BTC HTLC:  ${MEMPOOL_ADDR}${swap.btc_htlc_address}`);
  console.log(`  EVM HTLC:  ${ARBISCAN_ADDRESS}${swap.evm_htlc_address}`);
  if (swap.btc_fund_txid) {
    console.log(`  BTC Fund:  ${MEMPOOL_TX}${swap.btc_fund_txid}`);
  }
  if (swap.btc_claim_txid) {
    console.log(`  BTC Claim: ${MEMPOOL_TX}${swap.btc_claim_txid}`);
  }
  if (swap.evm_fund_txid) {
    console.log(`  EVM Fund:  ${ARBISCAN_TX}${swap.evm_fund_txid}`);
  }
  if (swap.evm_claim_txid) {
    console.log(`  EVM Claim: ${ARBISCAN_TX}${swap.evm_claim_txid}`);
  }
  if (swap.target_evm_address) {
    console.log(`  EVM To:    ${swap.target_evm_address}`);
  }
}

export function printSwapStatus(swap: SupportedSwap) {
  if (swap.direction === "evm_to_bitcoin") {
    printEvmToBitcoinStatus(swap);
    return;
  }

  printBitcoinToEvmStatus(swap);
}

export async function checkStatus(swapId: string) {
  const client = await buildClient();
  const swap = await client.getSwap(swapId, { updateStorage: true });
  if (
    swap.direction !== "evm_to_bitcoin" &&
    swap.direction !== "bitcoin_to_evm"
  ) {
    throw new Error(`Unsupported swap direction: ${swap.direction}`);
  }
  printSwapStatus(swap);
}
