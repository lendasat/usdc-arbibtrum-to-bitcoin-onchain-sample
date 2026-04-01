import type {
  EvmToBitcoinSwapResponse,
  GetSwapResponse,
} from "@lendasat/lendaswap-sdk-pure";
import { Client } from "@lendasat/lendaswap-sdk-pure";
import { sqliteStorageFactory } from "@lendasat/lendaswap-sdk-pure/node";
import { loadOrCreateMnemonic } from "./env.js";

export type EvmToBtcSwap = EvmToBitcoinSwapResponse & {
  direction: "evm_to_bitcoin";
};

export function asEvmToBtc(swap: GetSwapResponse): EvmToBtcSwap {
  if (swap.direction !== "evm_to_bitcoin") {
    throw new Error(`Expected evm_to_bitcoin swap, got ${swap.direction}`);
  }
  return swap;
}

const DB_PATH = "./lendaswap.db";

export async function buildClient(): Promise<Client> {
  const mnemonic = await loadOrCreateMnemonic();
  const { walletStorage, swapStorage } = sqliteStorageFactory(DB_PATH);

  return await Client.builder()
    .withSignerStorage(walletStorage)
    .withSwapStorage(swapStorage)
    .withMnemonic(mnemonic)
    .build();
}

const TERMINAL_STATES = new Set([
  "serverredeemed",
  "expired",
  "clientrefunded",
  "clientfundedserverrefunded",
  "clientrefundedserverfunded",
  "clientrefundedserverrefunded",
]);

const STATUS_ORDER = [
  "pending",
  "clientfundingseen",
  "clientfunded",
  "serverfunded",
  "clientredeeming",
  "clientredeemed",
  "serverredeemed",
];

function isStatusAfter(current: string, target: string): boolean {
  const currentIdx = STATUS_ORDER.indexOf(current);
  const targetIdx = STATUS_ORDER.indexOf(target);
  return currentIdx > targetIdx && currentIdx !== -1 && targetIdx !== -1;
}

export async function waitForSwapStatus(
  client: Client,
  swapId: string,
  targetStatus: string,
  pollIntervalMs = 3000,
): Promise<EvmToBtcSwap> {
  while (true) {
    const swap = asEvmToBtc(
      await client.getSwap(swapId, { updateStorage: true }),
    );

    if (
      swap.status === targetStatus ||
      isStatusAfter(swap.status, targetStatus)
    ) {
      return swap;
    }

    if (TERMINAL_STATES.has(swap.status)) {
      throw new Error(`Swap reached terminal state: ${swap.status}`);
    }

    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}
