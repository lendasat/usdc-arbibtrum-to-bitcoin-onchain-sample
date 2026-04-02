import { asEvmToBtc, buildClient, waitForSwapStatus } from "../client.js";
import { claimWithRetries } from "./claim.js";
import { printSwapStatus } from "./status.js";

export async function continueSwap(swapId: string, feeRate = 1) {
  const client = await buildClient();

  const swap = asEvmToBtc(
    await client.getSwap(swapId, { updateStorage: true }),
  );

  console.log(`\nResuming swap ${swapId} (status: ${swap.status})`);

  const btcAddress = swap.target_btc_address;
  if (!btcAddress) {
    throw new Error("Swap has no target BTC address set.");
  }

  switch (swap.status) {
    case "pending": {
      // Fund gaslessly, then continue through the rest
      console.log(`\nInitiating gasless funding...`);
      const { txHash } = await client.fundSwapGasless(swapId);
      console.log(`Swap funded! TX: ${txHash}`);

      console.log(`\nWaiting for Bitcoin to be locked...`);
      await waitForSwapStatus(client, swapId, "serverfunded");
      console.log(`Bitcoin locked by server!`);

      await claimWithRetries(client, swapId, btcAddress, feeRate);
      break;
    }

    case "clientfundingseen":
    case "clientfunded": {
      // Already funded, wait for server to lock BTC
      console.log(`\nWaiting for Bitcoin to be locked...`);
      await waitForSwapStatus(client, swapId, "serverfunded");
      console.log(`Bitcoin locked by server!`);

      await claimWithRetries(client, swapId, btcAddress, feeRate);
      break;
    }

    case "serverfunded": {
      // Server has locked BTC, claim it
      await claimWithRetries(client, swapId, btcAddress, feeRate);
      break;
    }

    case "clientredeemed":
    case "serverredeemed": {
      console.log(`\nSwap already completed.`);
      break;
    }

    default: {
      console.log(
        `\nSwap is in state "${swap.status}" and cannot be continued.`,
      );
      console.log(`Try "refund ${swapId}" instead.`);
      break;
    }
  }

  const finalSwap = asEvmToBtc(
    await client.getSwap(swapId, { updateStorage: true }),
  );
  printSwapStatus(finalSwap);
}
