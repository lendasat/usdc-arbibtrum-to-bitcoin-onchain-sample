import { Signer } from "@lendasat/lendaswap-sdk-pure";
import {
  createPublicClient,
  encodePacked,
  erc20Abi,
  formatUnits,
  getContract,
  hexToBigInt,
  http,
  maxUint256,
  parseErc6492Signature,
  parseUnits,
} from "viem";
import {
  createBundlerClient,
  toSimple7702SmartAccount,
} from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { loadOrCreateMnemonic } from "../env.js";

const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const PAYMASTER_ADDRESS = "0x0578cFB241215b77442a541325d6A4E6dFE700Ec" as const;
const PIMLICO_BUNDLER_URL = "https://public.pimlico.io/v2/42161/rpc";

const eip2612Abi = [
  ...erc20Abi,
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    stateMutability: "view",
    type: "function",
    name: "nonces",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function signPermit(args: {
  client: ReturnType<typeof createPublicClient>;
  account: Awaited<ReturnType<typeof toSimple7702SmartAccount>>;
  spenderAddress: `0x${string}`;
  permitAmount: bigint;
}) {
  const token = getContract({
    client: args.client,
    address: USDC_ADDRESS,
    abi: eip2612Abi,
  });

  const permitData = {
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit" as const,
    domain: {
      name: await token.read.name(),
      version: await token.read.version(),
      chainId: arbitrum.id,
      verifyingContract: USDC_ADDRESS,
    },
    message: {
      owner: args.account.address,
      spender: args.spenderAddress,
      value: args.permitAmount,
      nonce: await token.read.nonces([args.account.address]),
      deadline: maxUint256,
    },
  };

  const wrappedSig = await args.account.signTypedData(permitData);

  const isValid = await args.client.verifyTypedData({
    ...permitData,
    address: args.account.address,
    signature: wrappedSig,
  });
  if (!isValid) {
    throw new Error("Invalid permit signature");
  }

  const { signature } = parseErc6492Signature(wrappedSig);
  return signature;
}

export async function withdraw(destinationAddress: string, amountStr?: string) {
  const mnemonic = await loadOrCreateMnemonic();
  const signer = Signer.fromMnemonic(mnemonic);
  const { secretKey } = signer.deriveEvmKey();

  const privateKeyHex =
    `0x${Buffer.from(secretKey).toString("hex")}` as `0x${string}`;

  const chain = arbitrum;
  const client = createPublicClient({ chain, transport: http() });
  const owner = privateKeyToAccount(privateKeyHex);
  const account = await toSimple7702SmartAccount({ client, owner });

  const usdc = getContract({ client, address: USDC_ADDRESS, abi: erc20Abi });
  const balance = await usdc.read.balanceOf([account.address]);

  console.log(`\n--- Withdraw USDC (gasless via Circle Paymaster) ---`);
  console.log(`  From:    ${account.address}`);
  console.log(`  To:      ${destinationAddress}`);
  console.log(`  Balance: ${formatUnits(balance, 6)} USDC`);

  // Paymaster pre-funds gas by pulling USDC before the transfer executes,
  // so we reserve a buffer when withdrawing the full balance.
  const GAS_RESERVE = 50_000n; // 0.050 USDC (more than enough for gas + 10% surcharge)
  const isFullWithdraw = !amountStr;
  const amount = isFullWithdraw
    ? balance > GAS_RESERVE
      ? balance - GAS_RESERVE
      : 0n
    : parseUnits(amountStr, 6);

  if (amount === 0n) {
    console.log(`\nNothing to withdraw (balance too low to cover gas).`);
    return;
  }
  if (amount > balance) {
    console.error(
      `\nInsufficient balance. Have ${formatUnits(balance, 6)} USDC, want ${formatUnits(amount, 6)} USDC.`,
    );
    process.exit(1);
  }

  console.log(`  Amount:  ${formatUnits(amount, 6)} USDC`);
  if (isFullWithdraw) {
    console.log(`  Reserve: ${formatUnits(GAS_RESERVE, 6)} USDC (for gas)`);
  }
  console.log(`  Gas:     paid in USDC (Circle Paymaster)`);

  // Paymaster: signs EIP-2612 permit so Circle's contract can charge USDC for gas
  const paymaster = {
    async getPaymasterData() {
      const permitAmount = 10_000_000n; // up to 10 USDC for gas
      const permitSignature = await signPermit({
        client,
        account,
        spenderAddress: PAYMASTER_ADDRESS,
        permitAmount,
      });

      return {
        paymaster: PAYMASTER_ADDRESS,
        paymasterData: encodePacked(
          ["uint8", "address", "uint256", "bytes"],
          [0, USDC_ADDRESS, permitAmount, permitSignature],
        ),
        paymasterVerificationGasLimit: 200_000n,
        paymasterPostOpGasLimit: 15_000n,
        isFinal: true,
      };
    },
  };

  // Bundler: submits UserOperation via Pimlico
  const bundlerClient = createBundlerClient({
    account,
    client,
    paymaster,
    userOperation: {
      estimateFeesPerGas: async ({ bundlerClient }) => {
        const result = (await bundlerClient.request({
          method: "pimlico_getUserOperationGasPrice" as any,
        })) as any;
        return {
          maxFeePerGas: hexToBigInt(result.standard.maxFeePerGas),
          maxPriorityFeePerGas: hexToBigInt(
            result.standard.maxPriorityFeePerGas,
          ),
        };
      },
    },
    transport: http(PIMLICO_BUNDLER_URL),
  });

  // EIP-7702: authorize our EOA to act as a smart account for this UserOp
  const authorization = await owner.signAuthorization({
    chainId: chain.id,
    nonce: await client.getTransactionCount({ address: owner.address }),
    contractAddress: account.authorization.address,
  });

  console.log(`\nSending gasless transaction...`);
  const hash = await bundlerClient.sendUserOperation({
    account,
    calls: [
      {
        to: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [destinationAddress as `0x${string}`, amount],
      },
    ],
    authorization,
  });

  console.log(`UserOperation: ${hash}`);
  console.log(`Waiting for confirmation...`);

  const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });
  console.log(`\nWithdrawal complete!`);
  console.log(`TX: https://arbiscan.io/tx/${receipt.receipt.transactionHash}`);
}
