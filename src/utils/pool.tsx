import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program } from "@project-serum/anchor";
import idl from "../app/_idl/initialize_pool.json";

export const initializeNewPool = async (initialDetail: {
  wallet: any;
  mint: string;
  initialAmount0: number;
  initialAmount1: number;
}) => {
  const { wallet, mint, initialAmount0, initialAmount1 } = initialDetail;
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const provider = new AnchorProvider(
    connection,
    wallet as any,
    AnchorProvider.defaultOptions()
  );
  const contractProgramId = new PublicKey(
    "5nkUCxN2iFukZkE5yk2Z4HTxrPdwHZMmZskGzWcAfr1F"
  ); // Replace with your program ID
  const program = new Program(idl as any, contractProgramId, provider);
  try {
    // Define all the required accounts
    const programId = new PublicKey(
      "CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW"
    );
    const creator = wallet.publicKey;
    if (!creator) {
      throw new Error("Wallet public key is null");
    }

    const ammConfig = await connection.getProgramAccounts(programId, {
      filters: [
        {
          dataSize: 236, // Data size of AmmConfig struct
        },
      ],
    });
    if (ammConfig.length === 0) {
      throw new Error("No ammConfig account found.");
    }

    const ammConfigAccount = ammConfig[0]; // Get the first account
    const authority = await PublicKey.findProgramAddressSync(
      [Buffer.from("vault_and_lp_mint_auth_seed")],
      programId
    )[0];
    const token0Mint = await new PublicKey(
      "So11111111111111111111111111111111111111112"
    );
    const token1Mint = new PublicKey(mint);
    const [poolState, bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool", "utf-8"), // First seed
        ammConfigAccount.pubkey.toBuffer(), // Second seed
        token0Mint.toBuffer(), // Third seed
        token1Mint.toBuffer(), // Fourth seed
      ],
      programId // Program ID
    );

    const [lpMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_lp_mint"), poolState.toBuffer()],
      programId
    );
    const creatorToken0 = await getAssociatedTokenAddress(
      token0Mint,
      creator,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const creatorToken1 = await getAssociatedTokenAddress(
      token1Mint,
      creator,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const creatorLpToken = await getAssociatedTokenAddress(lpMint, creator);
    const [token0Vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolState.toBuffer(), token0Mint.toBuffer()],
      programId
    );
    const [token1Vault] = await PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolState.toBuffer(), token1Mint.toBuffer()],
      programId // Replace with the Raydium CP program ID
    );
    const createPoolFee = new PublicKey(
      "G11FKBRaAkHAKuLCgLM6K6NUc9rTjPAznRCjZifrTQe2"
    );
    const [observationState] = PublicKey.findProgramAddressSync(
      [Buffer.from("observation"), poolState.toBuffer()],
      programId
    );
    const tokenProgram = TOKEN_PROGRAM_ID;
    const token0Program = TOKEN_PROGRAM_ID;
    const token1Program = TOKEN_PROGRAM_ID;
    const associatedTokenProgram = ASSOCIATED_TOKEN_PROGRAM_ID;
    const systemProgram = SystemProgram.programId;
    const rent = new PublicKey("SysvarRent111111111111111111111111111111111");

    // // Convert values to BN
    // const initialAmount0 = new anchor.BN(100_000_000); // Replace with your actual value
    // const initialAmount1 = new anchor.BN(1_000_000_000); // Replace with your actual value
    const open_time = new BN(Math.floor(Date.now() / 1000));

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const transaction = await program.methods
      .initializeNewPool(
        new anchor.BN(initialAmount0),
        new anchor.BN(initialAmount1),
        open_time
      )
      .accounts({
        cpSwapProgram: programId,
        creator: creator,
        ammConfig: ammConfigAccount.pubkey,
        authority: authority,
        token0Mint: token0Mint,
        token1Mint: token1Mint,
        poolState: poolState,
        lpMint: lpMint,
        creatorToken0: creatorToken0,
        creatorToken1: creatorToken1,
        creatorLpToken: creatorLpToken,
        token0Vault: token0Vault,
        token1Vault: token1Vault,
        createPoolFee: createPoolFee,
        observationState: observationState,
        tokenProgram: tokenProgram,
        token0Program: token0Program,
        token1Program: token1Program,
        associatedTokenProgram: associatedTokenProgram,
        systemProgram: systemProgram,
        rent: rent,
      })
      .rpc();

    await connection.confirmTransaction({
      signature: transaction,
      blockhash,
      lastValidBlockHeight,
    });
    console.log(transaction);
    return transaction;
  } catch (error) {
    console.error("Error initializing new pool:", error);
  }
};
