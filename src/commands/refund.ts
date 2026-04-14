import { getArbitrumBlockTimestamp } from "../balance.js";
import { asEvmToBtc, buildClient } from "../client.js";
import { printSwapStatus } from "./status.js";

const COLLAB_REFUND_STATES = new Set([
  "clientfundedserverrefunded",
  "expired",
  "clientinvalidfunded",
  "clientfundedtoolate",
]);

export async function refundSwap(swapId: string) {
  const client = await buildClient();

  const storedSwap = await client.getSwap(swapId, { updateStorage: true });
  if (storedSwap.direction !== "evm_to_bitcoin") {
    throw new Error(
      `Refund currently supports only USDC -> BTC swaps. Swap ${swapId} is ${storedSwap.direction}.`,
    );
  }

  const swap = asEvmToBtc(storedSwap);

  console.log(`\nSwap ${swapId} is in state: ${swap.status}`);

  if (COLLAB_REFUND_STATES.has(swap.status)) {
    console.log(`Attempting collaborative (gasless) refund...`);
    const result = await client.refundSwap(swapId, {
      collaborative: true,
      mode: "swap-back",
    });

    if (result.success) {
      console.log(`Refund successful!`);
      console.log(`Message: ${result.message}`);
      if (result.txId) console.log(`TX: ${result.txId}`);
    } else {
      console.error(`Refund failed: ${result.message}`);
    }
  } else {
    // Check if timelock has expired for non-collaborative refund
    const now = await getArbitrumBlockTimestamp();
    const timelock = swap.evm_refund_locktime;

    if (now < timelock) {
      const remaining = timelock - now;
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.ceil((remaining % 3600) / 60);
      console.error(
        `\nCannot refund yet. Swap status "${swap.status}" does not allow collaborative refund.`,
      );
      console.error(
        `Timelock expires in ${hours}h ${minutes}m (at ${new Date(timelock * 1000).toLocaleString()}).`,
      );
      console.error(`Try again after the timelock expires.`);
    } else {
      console.log(`Timelock expired. Attempting on-chain refund...`);
      const result = await client.refundSwap(swapId, {
        mode: "swap-back",
      });

      if (result.success) {
        console.log(`Refund successful!`);
        console.log(`Message: ${result.message}`);
        if (result.txId) console.log(`TX: ${result.txId}`);
      } else {
        console.error(`Refund failed: ${result.message}`);
      }
    }
  }

  const finalSwap = asEvmToBtc(
    await client.getSwap(swapId, { updateStorage: true }),
  );
  printSwapStatus(finalSwap);
}
