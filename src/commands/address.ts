import { formatUsdc, getUsdcBalance } from "../balance.js";
import { buildClient } from "../client.js";

export async function showAddress() {
  const client = await buildClient();
  const evmAddress = client.getEvmAddress();
  const balance = await getUsdcBalance(evmAddress);

  console.log(`\n--- Wallet Info ---`);
  console.log(`  EVM Address: ${evmAddress}`);
  console.log(`  USDC Balance: ${formatUsdc(balance)} USDC`);
}
