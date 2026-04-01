import { buildClient } from "../client.js";

export async function refundSwap(swapId: string) {
  const client = await buildClient();

  console.log(`\nAttempting collaborative refund for swap ${swapId}...`);

  const result = await client.refundSwap(swapId, {
    collaborative: true,
    mode: "swap-back",
  });

  if (result.success) {
    console.log(`Refund successful!`);
    console.log(`Message: ${result.message}`);
    if (result.txId) console.log(`TX: ${result.txId}`);
  } else {
    console.log(`Refund failed: ${result.message}`);
    console.log(`You may need to wait for the timelock to expire.`);
  }
}
