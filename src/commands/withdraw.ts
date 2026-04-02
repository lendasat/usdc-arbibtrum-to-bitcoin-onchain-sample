import { Signer } from "@lendasat/lendaswap-sdk-pure";
import { ethers } from "ethers";
import { formatUsdc, getUsdcBalance, parseUsdc } from "../balance.js";
import { loadOrCreateMnemonic } from "../env.js";

const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
];

export async function withdraw(destinationAddress: string, amountStr?: string) {
  const mnemonic = await loadOrCreateMnemonic();
  const signer = Signer.fromMnemonic(mnemonic);
  const { secretKey } = signer.deriveEvmKey();

  const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC);
  const privateKeyHex = ethers.hexlify(secretKey);
  const wallet = new ethers.Wallet(privateKeyHex, provider);

  const balance = await getUsdcBalance(wallet.address);
  console.log(`\n--- Withdraw USDC ---`);
  console.log(`  From:    ${wallet.address}`);
  console.log(`  To:      ${destinationAddress}`);
  console.log(`  Balance: ${formatUsdc(balance)} USDC`);

  const amount = amountStr ? parseUsdc(amountStr) : balance;

  if (amount === 0n) {
    console.log(`\nNothing to withdraw.`);
    return;
  }
  if (amount > balance) {
    console.error(
      `\nInsufficient balance. Have ${formatUsdc(balance)} USDC, want ${formatUsdc(amount)} USDC.`,
    );
    process.exit(1);
  }

  console.log(`  Amount:  ${formatUsdc(amount)} USDC`);

  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_TRANSFER_ABI, wallet);
  console.log(`\nSending transaction...`);
  const tx = await usdc.transfer(destinationAddress, amount);
  console.log(`TX: https://arbiscan.io/tx/${tx.hash}`);

  console.log(`Waiting for confirmation...`);
  const receipt = await tx.wait();

  if (receipt.status === 1) {
    console.log(`\nWithdrawal complete!`);
  } else {
    console.error(`\nTransaction reverted.`);
  }
}
