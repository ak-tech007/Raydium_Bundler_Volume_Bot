import {
  Keypair,
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@project-serum/anchor";
import idl from "../app/_idl/initialize_pool.json";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as dotenv from "dotenv";
import Wallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { delay } from "@/utils/distribute";
import { get_market_keys } from "./getMarketKeys";
dotenv.config();

const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || "",
  "confirmed"
);

export const sellCustomTokensOnce = async (
  wallet: Keypair,
  amount: number,
  mint: string,
  market_id: string
) => {
  const wallet_ = new Wallet(wallet);
  const provider = new anchor.AnchorProvider(
    connection,
    wallet_,
    anchor.AnchorProvider.defaultOptions()
  );

  const contractProgramId = new PublicKey(
    "DdHFxFR8mR8yVWwYhK9PHPTHTBJf1xQHTRMhEXGoJC1f"
  );
  const program = new Program(idl as any, contractProgramId, provider);

  try {
    const RAYDIUM_PROGRAM_ID = new PublicKey(
      "HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8"
    );
    const OPENBOOK_PROGRAM_ID = new PublicKey(
      "EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"
    );
    const MARKET_KEY = new PublicKey(market_id);
    const COIN_MINT = new PublicKey(mint); // Replace with coin mint
    const PC_MINT = new PublicKey(
      "So11111111111111111111111111111111111111112"
    );
    const [ammPda, ammBump] = PublicKey.findProgramAddressSync(
      [
        RAYDIUM_PROGRAM_ID.toBuffer(),
        MARKET_KEY.toBuffer(),
        Buffer.from("amm_associated_seed"),
      ],
      RAYDIUM_PROGRAM_ID
    );
    const [ammAuthorityPda, ammAuthorityBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from("amm authority")],
        RAYDIUM_PROGRAM_ID
      );
    const [ammOpenOrdersPda, ammOpenOrdersbump] =
      PublicKey.findProgramAddressSync(
        [
          RAYDIUM_PROGRAM_ID.toBuffer(),
          MARKET_KEY.toBuffer(),
          Buffer.from("open_order_associated_seed"),
        ],
        RAYDIUM_PROGRAM_ID
      );
    const [ammCoinVaultPda, ammCoinVaultbump] =
      PublicKey.findProgramAddressSync(
        [
          RAYDIUM_PROGRAM_ID.toBuffer(),
          MARKET_KEY.toBuffer(),
          Buffer.from("coin_vault_associated_seed"),
        ],
        RAYDIUM_PROGRAM_ID
      );
    const [ammPcVaultPda, ammPcVaultbump] = PublicKey.findProgramAddressSync(
      [
        RAYDIUM_PROGRAM_ID.toBuffer(),
        MARKET_KEY.toBuffer(),
        Buffer.from("pc_vault_associated_seed"),
      ],
      RAYDIUM_PROGRAM_ID
    );
    const market_keys = await get_market_keys(market_id);
    const tokenProgram = TOKEN_PROGRAM_ID;
    const wallet1_token_coin = await getAssociatedTokenAddress(
      COIN_MINT,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const wallet1_token_pc = await getAssociatedTokenAddress(
      PC_MINT,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const maxRetries = 5;
    let attempt = 0;
    let basePriorityFee = 5000;
    const feeIncreaseFactor = 1.2;

    while (attempt < maxRetries) {
      try {
        const transaction_swap1 = new Transaction();
        transaction_swap1.add(
          await program.methods
            .swapbasein(new anchor.BN(BigInt(amount)), new anchor.BN(BigInt(0)))
            .accounts({
              ammProgram: RAYDIUM_PROGRAM_ID,
              ammPool: ammPda,
              ammAuthority: ammAuthorityPda,
              ammOpenOrders: ammOpenOrdersPda,
              ammCoinVault: ammCoinVaultPda,
              ammPcVault: ammPcVaultPda,
              marketProgram: OPENBOOK_PROGRAM_ID,
              market: MARKET_KEY,
              marketBids: market_keys.MARKET_BIDS_KEY,
              marketAsks: market_keys.MARKET_ASKS_KEY,
              marketEventQueue: market_keys.MARKET_EVENT_QUEUE_KEY,
              marketCoinVault: market_keys.MARKET_COIN_VAULT_KEY,
              marketPcVault: market_keys.MARKET_PC_VAULT_KEY,
              marketVaultSigner: market_keys.MARKET_VAULT_SIGNER_KEY,
              userTokenSource: wallet1_token_coin,
              userTokenDestination: wallet1_token_pc,
              userSourceOwner: wallet.publicKey,
              splToken: tokenProgram,
            })
            .instruction()
        );

        // ✅ Fetch latest blockhash
        const latestBlockhash = await connection.getLatestBlockhash();
        transaction_swap1.recentBlockhash = latestBlockhash.blockhash;
        transaction_swap1.feePayer = wallet.publicKey;

        // ✅ Dynamically increase priority fee per retry
        const priorityFee = Math.ceil(
          basePriorityFee * Math.pow(feeIncreaseFactor, attempt)
        );

        const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice(
          {
            microLamports: priorityFee,
          }
        );

        const feeEstimate = await transaction_swap1.getEstimatedFee(connection);
        if (feeEstimate !== null) {
          console.log(`Estimated transaction fee: ${feeEstimate} SOL`);
        } else {
          console.log("Unable to estimate transaction fee");
        }

        // ✅ Add priority fee instruction (only once per transaction)
        transaction_swap1.add(priorityFeeInstruction);

        // ✅ Sign the transaction
        transaction_swap1.sign(wallet);

        // ✅ Send the transaction
        const signature = await connection.sendRawTransaction(
          transaction_swap1.serialize()
        );

        console.log(
          `🚀 Transaction sent. Signature: ${signature} (Priority Fee: ${priorityFee})`
        );
        return signature; // Exit on success
      } catch (error) {
        console.error(
          `❌ Attempt ${attempt + 1} failed (Priority Fee:):`,
          error
        );
        attempt++;

        if (attempt < maxRetries) {
          console.log(
            `🔁 Retrying... (${attempt}/${maxRetries}) with increased priority fee.`
          );
          await delay(2000);
        } else {
          console.error(
            `❌ All ${maxRetries} attempts failed for transaction.`
          );
          throw new Error("Transaction failed after maximum retries.");
        }
      }
    }
  } catch (error) {
    console.error("Sell transaction failed:", error);
    throw error;
  }
};
