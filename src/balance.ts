import { ethers } from "ethers";

const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";
const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const ERC20_BALANCE_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
];

/**
 * Check USDC balance on Arbitrum for a given address.
 * Returns balance in USDC base units (6 decimals).
 */
export async function getUsdcBalance(address: string): Promise<bigint> {
  const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC);
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_BALANCE_ABI, provider);
  return await usdc.balanceOf(address);
}

/**
 * Format USDC amount from base units (6 decimals) to human-readable string.
 */
export function formatUsdc(amount: bigint): string {
  return ethers.formatUnits(amount, 6);
}

/**
 * Parse USDC amount from human-readable string to base units (6 decimals).
 */
export function parseUsdc(amount: string): bigint {
  return ethers.parseUnits(amount, 6);
}

/**
 * Get the current block timestamp on Arbitrum.
 */
export async function getArbitrumBlockTimestamp(): Promise<number> {
  const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC);
  const block = await provider.getBlock("latest");
  return block!.timestamp;
}

/**
 * Poll for USDC balance to reach a minimum amount.
 * Returns once balance >= minAmount.
 */
export async function waitForUsdcDeposit(
  address: string,
  minAmount: bigint,
  pollIntervalMs = 5000,
): Promise<bigint> {
  while (true) {
    try {
      const balance = await getUsdcBalance(address);
      if (balance >= minAmount) {
        return balance;
      }
      process.stdout.write(".");
    } catch {
      process.stdout.write("x"); // connection error, retry
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}
