import { asEvmToBtc, buildClient, waitForSwapStatus } from "../client.js";
import { claimBitcoinWithRetries } from "./claim.js";
import { printSwapStatus } from "./status.js";

export async function continueUsdcToBitcoinSwap(swapId: string, feeRate = 1) {
  const client = await buildClient();

  const swap = asEvmToBtc(
    await client.getSwap(swapId, { updateStorage: true }),
  );

  console.log(`\nResuming USDC (Arbitrum) -> BTC swap ${swapId}`);
  console.log(`Current status: ${swap.status}`);

  const btcAddress = swap.target_btc_address;
  if (!btcAddress) {
    throw new Error("Swap has no target BTC address set.");
  }

  switch (swap.status) {
    case "pending": {
      console.log(`\nInitiating gasless funding...`);
      const { txHash } = await client.fundSwapGasless(swapId);
      console.log(`Swap funded. TX: ${txHash}`);

      console.log(`\nWaiting for Bitcoin to be locked...`);
      await waitForSwapStatus(client, swapId, "serverfunded");
      console.log(`Bitcoin locked by server.`);

      await claimBitcoinWithRetries(client, swapId, btcAddress, feeRate);
      break;
    }

    case "clientfundingseen":
    case "clientfunded": {
      console.log(`\nWaiting for Bitcoin to be locked...`);
      await waitForSwapStatus(client, swapId, "serverfunded");
      console.log(`Bitcoin locked by server.`);

      await claimBitcoinWithRetries(client, swapId, btcAddress, feeRate);
      break;
    }

    case "serverfunded": {
      await claimBitcoinWithRetries(client, swapId, btcAddress, feeRate);
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
