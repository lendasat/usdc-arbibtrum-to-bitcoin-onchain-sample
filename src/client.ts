import type {
  BitcoinToEvmSwapResponse,
  EvmToBitcoinSwapResponse,
  GetSwapResponse,
} from "@lendasat/lendaswap-sdk-pure";
import { Client } from "@lendasat/lendaswap-sdk-pure";
import { sqliteStorageFactory } from "@lendasat/lendaswap-sdk-pure/node";
import { loadOrCreateMnemonic } from "./env.js";

export type EvmToBtcSwap = EvmToBitcoinSwapResponse & {
  direction: "evm_to_bitcoin";
};

export type BitcoinToEvmSwap = BitcoinToEvmSwapResponse & {
  direction: "bitcoin_to_evm";
};

export type SupportedSwap = EvmToBtcSwap | BitcoinToEvmSwap;

export function asEvmToBtc(swap: GetSwapResponse): EvmToBtcSwap {
  if (swap.direction !== "evm_to_bitcoin") {
    throw new Error(`Expected evm_to_bitcoin swap, got ${swap.direction}`);
  }
  return swap;
}

export function asBitcoinToEvm(swap: GetSwapResponse): BitcoinToEvmSwap {
  if (swap.direction !== "bitcoin_to_evm") {
    throw new Error(`Expected bitcoin_to_evm swap, got ${swap.direction}`);
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
): Promise<SupportedSwap> {
  return waitForAnySwapStatus(client, swapId, [targetStatus], pollIntervalMs);
}

export async function waitForAnySwapStatus(
  client: Client,
  swapId: string,
  targetStatuses: string[],
  pollIntervalMs = 3000,
): Promise<SupportedSwap> {
  while (true) {
    const swap = await client.getSwap(swapId, { updateStorage: true });

    if (
      swap.direction !== "evm_to_bitcoin" &&
      swap.direction !== "bitcoin_to_evm"
    ) {
      throw new Error(`Unsupported swap direction: ${swap.direction}`);
    }

    for (const targetStatus of targetStatuses) {
      if (
        swap.status === targetStatus ||
        isStatusAfter(swap.status, targetStatus)
      ) {
        return swap;
      }
    }

    if (TERMINAL_STATES.has(swap.status)) {
      throw new Error(`Swap reached terminal state: ${swap.status}`);
    }

    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}
