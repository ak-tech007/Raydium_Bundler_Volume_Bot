import { Keypair, Connection, PublicKey, Transaction } from "@solana/web3.js";
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
dotenv.config();

const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || "",
  "confirmed"
);

export const sellCustomTokens = async (
  wallet: Keypair,
  amount: number,
  mint: string
) => {
  console.log(wallet, amount, mint);
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
    console.log(wallet.publicKey);
    console.log(payer);

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

    const sellTransaction = new Transaction();
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

    sellTransaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    sellTransaction.feePayer = wallet.publicKey;
    sellTransaction.sign(wallet);

    const signature = await connection.sendRawTransaction(
      sellTransaction.serialize()
    );

    return signature;
  } catch (error) {
    console.error("Sell transaction failed:", error);
    throw error;
  }
};
