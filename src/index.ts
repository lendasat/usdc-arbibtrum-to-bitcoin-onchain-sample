import "dotenv/config";
import { showAddress } from "./commands/address.js";
import { continueUsdcToBitcoinSwap } from "./commands/continue-usdc-to-btc.js";
import { listSwaps } from "./commands/list.js";
import { recoverSwaps } from "./commands/recover.js";
import { refundSwap } from "./commands/refund.js";
import { checkStatus } from "./commands/status.js";
import {
  continueBitcoinToUsdcSwap,
  createBitcoinToUsdcSwap,
} from "./commands/swap-btc-to-usdc.js";
import { createUsdcToBitcoinSwap } from "./commands/swap-usdc-to-btc.js";
import { withdraw } from "./commands/withdraw.js";

function printUsage() {
  console.log(`
Usage: npm start -- <command> [args]

Commands:
  swap usdc-to-btc create <amount-usdc> <btc-address> [fee-rate]
                                           Create a USDC -> BTC on-chain swap
  swap usdc-to-btc continue <swap-id> [fee-rate]
                                           Resume a USDC -> BTC on-chain swap
  swap btc-to-usdc create <amount-sats> <evm-address>
                                           Create a BTC on-chain -> USDC swap
  swap btc-to-usdc continue <swap-id>
                                           Resume a BTC on-chain -> USDC swap
  list                                     List all stored swaps
  status <swap-id>                         Check swap status
  refund <swap-id> [btc-address] [fee-rate]
                                           Refund a swap
  withdraw <address> [amount]              Send USDC to another wallet (default: full balance)
  recover                                  Recover swaps from server
  address                                  Show wallet address and balance

Examples:
  npm start -- swap usdc-to-btc create 100 bc1q...
  npm start -- swap usdc-to-btc continue <swap-id>
  npm start -- swap btc-to-usdc create 150000 0xAbCd...
  npm start -- swap btc-to-usdc continue <swap-id>
  npm start -- withdraw 0xAbCd...
  npm start -- withdraw 0xAbCd... 50
  npm start -- list
  npm start -- status <swap-id>
  npm start -- refund <swap-id>
  npm start -- refund <swap-id> bc1qrefund... 5
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "swap":
        if (args.length < 3) {
          console.error(
            "Usage: swap <usdc-to-btc|btc-to-usdc> <create|continue> ...",
          );
          process.exit(1);
        }
        await handleSwapCommand(args.slice(1));
        break;

      case "list":
        await listSwaps();
        break;

      case "status":
        if (args.length < 2) {
          console.error("Usage: status <swap-id>");
          process.exit(1);
        }
        await checkStatus(args[1]);
        break;

      case "refund":
        if (args.length < 2) {
          console.error("Usage: refund <swap-id> [btc-address] [fee-rate]");
          process.exit(1);
        }
        await refundSwap(
          args[1],
          args[2],
          args[3] ? Number(args[3]) : undefined,
        );
        break;

      case "withdraw":
        if (args.length < 2) {
          console.error("Usage: withdraw <address> [amount]");
          process.exit(1);
        }
        await withdraw(args[1], args[2]);
        break;

      case "recover":
        await recoverSwaps();
        break;

      case "address":
        await showAddress();
        break;

      default:
        printUsage();
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nError: ${message}`);
    if (process.env.DEBUG && err instanceof Error) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

async function handleSwapCommand(args: string[]) {
  const [direction, action, ...rest] = args;

  if (direction === "usdc-to-btc") {
    if (action === "create") {
      if (rest.length < 2) {
        console.error(
          "Usage: swap usdc-to-btc create <amount-usdc> <btc-address> [fee-rate]",
        );
        process.exit(1);
      }
      await createUsdcToBitcoinSwap(
        rest[0],
        rest[1],
        rest[2] ? Number(rest[2]) : undefined,
      );
      return;
    }

    if (action === "continue") {
      if (rest.length < 1) {
        console.error("Usage: swap usdc-to-btc continue <swap-id> [fee-rate]");
        process.exit(1);
      }
      await continueUsdcToBitcoinSwap(
        rest[0],
        rest[1] ? Number(rest[1]) : undefined,
      );
      return;
    }
  }

  if (direction === "btc-to-usdc") {
    if (action === "create") {
      if (rest.length < 2) {
        console.error(
          "Usage: swap btc-to-usdc create <amount-sats> <evm-address>",
        );
        process.exit(1);
      }
      await createBitcoinToUsdcSwap(rest[0], rest[1]);
      return;
    }

    if (action === "continue") {
      if (rest.length < 1) {
        console.error("Usage: swap btc-to-usdc continue <swap-id>");
        process.exit(1);
      }
      await continueBitcoinToUsdcSwap(rest[0]);
      return;
    }
  }

  printUsage();
  process.exit(1);
}

main();
