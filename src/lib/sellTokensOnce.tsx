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
dotenv.config();

const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || "",
  "confirmed"
);

export const sellCustomTokensOnce = async (
  wallet: Keypair,
  amount: number,
  mint: string
) => {
  const wallet_ = new Wallet(wallet);
  const provider = new anchor.AnchorProvider(
    connection,
    wallet_,
    anchor.AnchorProvider.defaultOptions()
  );

  const contractProgramId = new PublicKey(
    "5nkUCxN2iFukZkE5yk2Z4HTxrPdwHZMmZskGzWcAfr1F"
  );
  const program = new Program(idl as any, contractProgramId, provider);

  try {
    const programId = new PublicKey(
      "CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW"
    );
    const payer = wallet.publicKey;

    if (!payer) {
      throw new Error("Wallet public key is null");
    }

    const ammConfig = await connection.getProgramAccounts(programId, {
      filters: [{ dataSize: 236 }], // Data size of AmmConfig struct
    });

    if (ammConfig.length === 0) {
      throw new Error("No ammConfig account found.");
    }

    const ammConfigAccount = ammConfig[0];
    const authority = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_and_lp_mint_auth_seed")],
      programId
    )[0];
    const token0Mint = new PublicKey(
      "So11111111111111111111111111111111111111112"
    );
    const token1Mint = new PublicKey(mint);
    const [poolState] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool", "utf-8"),
        ammConfigAccount.pubkey.toBuffer(),
        token0Mint.toBuffer(),
        token1Mint.toBuffer(),
      ],
      programId
    );
    const [token0Vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolState.toBuffer(), token0Mint.toBuffer()],
      programId
    );
    const [token1Vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolState.toBuffer(), token1Mint.toBuffer()],
      programId
    );
    const [observationState] = PublicKey.findProgramAddressSync(
      [Buffer.from("observation"), poolState.toBuffer()],
      programId
    );

    const token0Program = TOKEN_PROGRAM_ID;
    const token1Program = TOKEN_PROGRAM_ID;

    const inputTokenAccount = await getAssociatedTokenAddress(
      token1Mint,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const outputTokenAccount = await getAssociatedTokenAddress(
      token0Mint,
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
        // ✅ Create a NEW transaction for each attempt to prevent duplicate instructions
        const sellTransaction = new Transaction();

        // ✅ Add the swap instruction (Fresh each retry)
        sellTransaction.add(
          await program.methods
            .swapBaseIn(new anchor.BN(amount), new anchor.BN(0))
            .accounts({
              cpSwapProgram: programId,
              payer: payer,
              authority: authority,
              ammConfig: ammConfigAccount.pubkey,
              poolState: poolState,
              inputTokenAccount: inputTokenAccount,
              outputTokenAccount: outputTokenAccount,
              inputVault: token1Vault,
              outputVault: token0Vault,
              inputTokenProgram: token1Program,
              outputTokenProgram: token0Program,
              inputTokenMint: token1Mint,
              outputTokenMint: token0Mint,
              observationState: observationState,
            })
            .instruction()
        );

        // ✅ Fetch latest blockhash
        const latestBlockhash = await connection.getLatestBlockhash();
        sellTransaction.recentBlockhash = latestBlockhash.blockhash;
        sellTransaction.feePayer = wallet.publicKey;

        // ✅ Dynamically increase priority fee per retry
        const priorityFee = Math.ceil(
          basePriorityFee * Math.pow(feeIncreaseFactor, attempt)
        );

        const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice(
          {
            microLamports: priorityFee,
          }
        );

        const feeEstimate = await sellTransaction.getEstimatedFee(connection);
        if (feeEstimate !== null) {
          console.log(`Estimated transaction fee: ${feeEstimate} SOL`);
        } else {
          console.log("Unable to estimate transaction fee");
        }

        // ✅ Add priority fee instruction (only once per transaction)
        sellTransaction.add(priorityFeeInstruction);

        // ✅ Sign the transaction
        sellTransaction.sign(wallet);

        // ✅ Send the transaction
        const signature = await connection.sendRawTransaction(
          sellTransaction.serialize()
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
