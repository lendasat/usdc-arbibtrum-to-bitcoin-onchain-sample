import { Asset } from "@lendasat/lendaswap-sdk-pure";
import {
  formatUsdc,
  getUsdcBalance,
  parseUsdc,
  waitForUsdcDeposit,
} from "../balance.js";
import { asEvmToBtc, buildClient, waitForSwapStatus } from "../client.js";
import { printSwapStatus } from "./status.js";

export async function createSwap(
  amountStr: string,
  btcAddress: string,
  feeRate = 1,
) {
  const client = await buildClient();

  const evmAddress = client.getEvmAddress();
  const sourceAmount = parseUsdc(amountStr);

  console.log(`\n--- LendaSwap: ${amountStr} USDC (Arbitrum) → BTC ---`);
  console.log(`Bitcoin destination: ${btcAddress}`);
  console.log(`Your deposit address: ${evmAddress}`);

  // Step 1: Check current balance
  console.log(`\nChecking USDC balance on Arbitrum...`);
  const currentBalance = await getUsdcBalance(evmAddress);
  console.log(`Current balance: ${formatUsdc(currentBalance)} USDC`);

  if (currentBalance < sourceAmount) {
    console.log(
      `\n>> Send at least ${amountStr} USDC to ${evmAddress} on Arbitrum`,
    );
    console.log(`   Waiting for deposit...`);
    await waitForUsdcDeposit(evmAddress, sourceAmount);
    console.log(); // newline after dots
  }

  console.log(`\nFunds available! Creating swap...`);

  // Step 2: Create the swap
  const result = await client.createSwap({
    source: Asset.USDC_ARBITRUM,
    target: Asset.BTC_ONCHAIN,
    sourceAmount: Number(sourceAmount),
    targetAddress: btcAddress,
    userAddress: evmAddress,
    gasless: true,
  });

  const swapId = result.response.id;
  const targetAmount = result.response.target_amount;

  console.log(`Swap created: ${swapId}`);
  console.log(
    `You will receive: ~${targetAmount ? targetAmount.toLocaleString() : "?"} sats`,
  );

  // Step 3: Fund the swap gaslessly
  console.log(`\nInitiating gasless funding...`);
  const { txHash: fundTxHash } = await client.fundSwapGasless(swapId);
  console.log(`Swap funded! TX: ${fundTxHash}`);

  // Step 4: Wait for server to fund Bitcoin HTLC
  console.log(`\nWaiting for Bitcoin to be locked...`);
  await waitForSwapStatus(client, swapId, "serverfunded");
  console.log(`Bitcoin locked by server!`);

  // Step 5: Claim BTC (0-conf)
  console.log(`\nClaiming Bitcoin (0-conf)...`);
  const claimResult = await client.claim(swapId, {
    destinationAddress: btcAddress,
    feeRateSatPerVb: feeRate,
  });

  if (claimResult.success) {
    console.log(`\n=== Swap Complete ===`);
    console.log(`Message: ${claimResult.message}`);
  } else {
    console.error(`\nClaim failed: ${claimResult.message}`);
    console.log(`Swap ID: ${swapId} (saved locally for recovery)`);
  }

  const finalSwap = asEvmToBtc(
    await client.getSwap(swapId, { updateStorage: true }),
  );
  printSwapStatus(finalSwap);
}
