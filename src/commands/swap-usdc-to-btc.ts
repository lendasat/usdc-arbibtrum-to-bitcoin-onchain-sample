import { Asset, type Chain } from "@lendasat/lendaswap-sdk-pure";
import {
  formatUsdc,
  getUsdcBalance,
  parseUsdc,
  waitForUsdcDeposit,
} from "../balance.js";
import { asEvmToBtc, buildClient, waitForSwapStatus } from "../client.js";
import { claimBitcoinWithRetries } from "./claim.js";
import { printSwapStatus } from "./status.js";

export async function createUsdcToBitcoinSwap(
  amountStr: string,
  btcAddress: string,
  feeRate = 1,
) {
  const client = await buildClient();

  const evmAddress = client.getEvmAddress();
  const sourceAmount = parseUsdc(amountStr);

  console.log(`\n--- LendaSwap: USDC (Arbitrum) -> BTC On-chain ---`);
  console.log(`USDC amount: ${amountStr}`);
  console.log(`Bitcoin destination: ${btcAddress}`);
  console.log(`Your deposit address: ${evmAddress}`);

  console.log(`\nFetching quote...`);
  const quote = await client.getQuote({
    sourceChain: Asset.USDC_ARBITRUM.chain as Chain,
    sourceToken: Asset.USDC_ARBITRUM.tokenId,
    targetChain: Asset.BTC_ONCHAIN.chain as Chain,
    targetToken: Asset.BTC_ONCHAIN.tokenId,
    sourceAmount: Number(sourceAmount),
  });

  const minSourceUsdc = formatUsdc(BigInt(quote.source_amount));
  console.log(`\n--- Quote ---`);
  console.log(`  You send:       ${minSourceUsdc} USDC`);
  console.log(`  You receive:    ~${quote.target_amount} sats`);
  console.log(
    `  Protocol fee:   ${quote.protocol_fee} sats (${(quote.protocol_fee_rate * 100).toFixed(2)}%)`,
  );

  const rate = Number(quote.exchange_rate);
  const minUsdc = BigInt(Math.ceil((quote.min_amount / 1e8) * rate * 1e6));
  const maxUsdc = BigInt(Math.ceil((quote.max_amount / 1e8) * rate * 1e6));

  const targetSats = Number(quote.target_amount);
  if (targetSats < quote.min_amount) {
    console.error(
      `\nAmount too low. Minimum is ${quote.min_amount} sats (~${formatUsdc(minUsdc)} USDC).`,
    );
    process.exit(1);
  }
  if (targetSats > quote.max_amount) {
    console.error(
      `\nAmount too high. Maximum is ${quote.max_amount} sats (~${formatUsdc(maxUsdc)} USDC).`,
    );
    process.exit(1);
  }

  console.log(`\nChecking USDC balance on Arbitrum...`);
  const currentBalance = await getUsdcBalance(evmAddress);
  console.log(`Current balance: ${formatUsdc(currentBalance)} USDC`);

  if (currentBalance < sourceAmount) {
    console.log(
      `\n>> Send at least ${amountStr} USDC to ${evmAddress} on Arbitrum`,
    );
    console.log(`   Waiting for deposit...`);
    await waitForUsdcDeposit(evmAddress, sourceAmount);
    console.log();
  }

  console.log(`\nFunds available. Creating swap...`);

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

  console.log(`\nInitiating gasless funding...`);
  const { txHash: fundTxHash } = await client.fundSwapGasless(swapId);
  console.log(`Swap funded. TX: ${fundTxHash}`);

  console.log(`\nWaiting for Bitcoin to be locked...`);
  await waitForSwapStatus(client, swapId, "serverfunded");
  console.log(`Bitcoin locked by server.`);

  await claimBitcoinWithRetries(client, swapId, btcAddress, feeRate);

  const finalSwap = asEvmToBtc(
    await client.getSwap(swapId, { updateStorage: true }),
  );
  printSwapStatus(finalSwap);
}
