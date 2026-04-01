import { formatUsdc } from "../balance.js";
import type { EvmToBtcSwap } from "../client.js";
import { asEvmToBtc, buildClient } from "../client.js";

export function printSwapStatus(swap: EvmToBtcSwap) {
  console.log(`\n--- Swap Status ---`);
  console.log(`  ID:        ${swap.id}`);
  console.log(`  Direction: ${swap.direction}`);
  console.log(`  Status:    ${swap.status}`);
  console.log(`  Source:    ${formatUsdc(BigInt(swap.source_amount))} USDC`);
  console.log(`  Target:    ${swap.target_amount} sats`);
  console.log(`  BTC HTLC:  ${swap.btc_htlc_address}`);
  console.log(`  EVM HTLC:  ${swap.evm_htlc_address}`);
  if (swap.evm_fund_txid) {
    console.log(`  EVM Fund:  ${swap.evm_fund_txid}`);
  }
  if (swap.evm_claim_txid) {
    console.log(`  EVM Claim: ${swap.evm_claim_txid}`);
  }
  if (swap.btc_fund_txid) {
    console.log(`  BTC Fund:  ${swap.btc_fund_txid}`);
  }
  if (swap.btc_claim_txid) {
    console.log(`  BTC Claim: ${swap.btc_claim_txid}`);
  }
}

export async function checkStatus(swapId: string) {
  const client = await buildClient();
  const swap = asEvmToBtc(
    await client.getSwap(swapId, { updateStorage: true }),
  );
  printSwapStatus(swap);
}
