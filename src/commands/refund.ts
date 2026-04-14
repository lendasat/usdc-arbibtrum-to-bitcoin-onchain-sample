import { getArbitrumBlockTimestamp } from "../balance.js";
import { asBitcoinToEvm, asEvmToBtc, buildClient } from "../client.js";
import { printSwapStatus } from "./status.js";

const COLLAB_REFUND_STATES = new Set([
  "clientfundedserverrefunded",
  "expired",
  "clientinvalidfunded",
  "clientfundedtoolate",
]);

async function refundUsdcToBitcoinSwap(swapId: string) {
  const client = await buildClient();
  const swap = asEvmToBtc(
    await client.getSwap(swapId, { updateStorage: true }),
  );

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

async function refundBitcoinToUsdcSwap(
  swapId: string,
  destinationAddress: string,
  feeRateSatPerVb = 2,
) {
  const client = await buildClient();
  const swap = asBitcoinToEvm(
    await client.getSwap(swapId, { updateStorage: true }),
  );

  console.log(`\nSwap ${swapId} is in state: ${swap.status}`);

  if (!swap.btc_fund_txid) {
    throw new Error(
      "Swap has no BTC funding transaction yet, so there is nothing to refund.",
    );
  }

  if (swap.evm_claim_txid || swap.status === "clientredeemed") {
    throw new Error("Swap has already been claimed on Arbitrum.");
  }

  const { mtp } = await client.getMtp();
  if (mtp < swap.btc_refund_locktime) {
    const remaining = swap.btc_refund_locktime - mtp;
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.ceil((remaining % 3600) / 60);
    console.error(`\nCannot refund yet.`);
    console.error(
      `Bitcoin HTLC timelock expires in ${hours}h ${minutes}m (at ${new Date(swap.btc_refund_locktime * 1000).toLocaleString()}).`,
    );
    console.error(`Try again after the timelock expires.`);
    return;
  }

  console.log(`Attempting BTC refund...`);
  const result = await client.refundSwap(swapId, {
    destinationAddress,
    feeRateSatPerVb,
  });

  if (result.success) {
    console.log(`Refund successful!`);
    console.log(`Message: ${result.message}`);
    if (result.txId) console.log(`TX: ${result.txId}`);
    if (result.refundAmount) {
      console.log(`Amount: ${result.refundAmount.toString()} sats`);
    }
  } else {
    console.error(`Refund failed: ${result.message}`);
  }

  const finalSwap = asBitcoinToEvm(
    await client.getSwap(swapId, { updateStorage: true }),
  );
  printSwapStatus(finalSwap);
}

export async function refundSwap(
  swapId: string,
  destinationAddress?: string,
  feeRate?: number,
) {
  const client = await buildClient();
  const swap = await client.getSwap(swapId, { updateStorage: true });

  if (swap.direction === "evm_to_bitcoin") {
    await refundUsdcToBitcoinSwap(swapId);
    return;
  }

  if (swap.direction === "bitcoin_to_evm") {
    if (!destinationAddress) {
      throw new Error(
        "BTC -> USDC refunds require a BTC destination address: refund <swap-id> <btc-address> [fee-rate]",
      );
    }
    await refundBitcoinToUsdcSwap(swapId, destinationAddress, feeRate);
    return;
  }

  throw new Error(`Unsupported refund direction: ${swap.direction}`);
}
