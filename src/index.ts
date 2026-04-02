import "dotenv/config";
import { showAddress } from "./commands/address.js";
import { continueSwap } from "./commands/continue-swap.js";
import { createSwap } from "./commands/create-swap.js";
import { listSwaps } from "./commands/list.js";
import { recoverSwaps } from "./commands/recover.js";
import { refundSwap } from "./commands/refund.js";
import { checkStatus } from "./commands/status.js";
import { withdraw } from "./commands/withdraw.js";

function printUsage() {
  console.log(`
Usage: npm start -- <command> [args]

Commands:
  swap <amount> <btc-address> [fee-rate]   Create a USDC→BTC swap (fee-rate in sat/vB, default: 1)
  continue <swap-id> [fee-rate]            Resume an interrupted swap
  list                                     List all stored swaps
  status <swap-id>                         Check swap status
  refund <swap-id>                         Refund a swap
  withdraw <address> [amount]               Send USDC to another wallet (default: full balance)
  recover                                  Recover swaps from server
  address                                  Show wallet address and balance

Examples:
  npm start -- swap 100 bc1q...
  npm start -- continue <swap-id>
  npm start -- withdraw 0xAbCd...
  npm start -- withdraw 0xAbCd... 50
  npm start -- list
  npm start -- status <swap-id>
  npm start -- refund <swap-id>
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "swap":
        if (args.length < 3) {
          console.error("Usage: swap <amount> <btc-address> [fee-rate]");
          process.exit(1);
        }
        await createSwap(
          args[1],
          args[2],
          args[3] ? Number(args[3]) : undefined,
        );
        break;

      case "continue":
        if (args.length < 2) {
          console.error("Usage: continue <swap-id> [fee-rate]");
          process.exit(1);
        }
        await continueSwap(args[1], args[2] ? Number(args[2]) : undefined);
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
          console.error("Usage: refund <swap-id>");
          process.exit(1);
        }
        await refundSwap(args[1]);
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

main();
