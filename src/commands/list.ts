import type { EvmToBtcSwap } from "../client.js";
import { buildClient } from "../client.js";

export async function listSwaps() {
  const client = await buildClient();
  const swaps = await client.listAllSwaps();

  if (swaps.length === 0) {
    console.log("No swaps found.");
    return;
  }

  console.log(`\n--- Stored Swaps (${swaps.length}) ---\n`);
  for (const swap of swaps) {
    const response = swap.response as EvmToBtcSwap;
    const created = new Date(swap.storedAt).toLocaleString();
    console.log(`  ${swap.swapId}`);
    console.log(
      `    Direction: ${response.direction} | Status: ${response.status}`,
    );
    console.log(`    Created: ${created}`);
    if (swap.targetAddress) {
      console.log(`    Target: ${swap.targetAddress}`);
    }
    console.log();
  }
}
