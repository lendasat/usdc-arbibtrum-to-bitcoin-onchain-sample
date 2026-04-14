import type { ClaimResult, Client } from "@lendasat/lendaswap-sdk-pure";

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

export async function claimBitcoinWithRetries(
  client: Client,
  swapId: string,
  btcAddress: string,
  feeRate: number,
) {
  console.log(`\nClaiming Bitcoin (0-conf)...`);

  let claimResult: ClaimResult | undefined;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    claimResult = await client.claim(swapId, {
      destinationAddress: btcAddress,
      feeRateSatPerVb: feeRate,
    });

    if (claimResult.success) break;

    if (
      attempt < MAX_RETRIES &&
      claimResult.message.includes("Could not find UTXO")
    ) {
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      continue;
    }
    break;
  }

  if (claimResult?.success) {
    console.log(`\n=== Swap Complete ===`);
    console.log(`Message: ${claimResult.message}`);
  } else {
    console.error(`\nClaim failed: ${claimResult?.message}`);
    console.log(`Swap ID: ${swapId} (saved locally for recovery)`);
  }
}

export async function claimEvmSwap(client: Client, swapId: string) {
  console.log(`\nClaiming USDC on Arbitrum...`);

  const claimResult = await client.claim(swapId);

  if (claimResult.success) {
    console.log(`\n=== Swap Complete ===`);
    console.log(`Message: ${claimResult.message}`);
  } else {
    console.error(`\nClaim failed: ${claimResult.message}`);
    console.log(`Swap ID: ${swapId} (saved locally for recovery)`);
  }
}
