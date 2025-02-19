"use client";
import {
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

export const createNewmint = async (wallet: any, amount: number) => {
  try {
    // Establish connection to Solana devnet
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const phantomPublicKey = wallet.publicKey;

    const programId = new PublicKey(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    );
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    );
    const decimals = 6;
    const lamports = await getMinimumBalanceForRentExemptMint(connection);

    // Generate a new keypair for the mint account
    const mintAccount = Keypair.generate();
    const associatedToken = await getAssociatedTokenAddressSync(
      mintAccount.publicKey,
      wallet.publicKey,
      false,
      programId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: phantomPublicKey,
        newAccountPubkey: mintAccount.publicKey,
        space: MINT_SIZE,
        lamports,
        programId,
      }),
      createInitializeMint2Instruction(
        mintAccount.publicKey,
        decimals,
        phantomPublicKey,
        phantomPublicKey,
        programId
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        associatedToken,
        wallet.publicKey,
        mintAccount.publicKey,
        programId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mintAccount.publicKey,
        associatedToken,
        wallet.publicKey,
        amount,
        [],
        programId
      ),
      // 🔹 Revoke Mint Authority
      createSetAuthorityInstruction(
        mintAccount.publicKey,
        wallet.publicKey, // Current authority
        AuthorityType.MintTokens,
        null // Setting to null removes authority
      ),
      // 🔹 Revoke Freeze Authority
      createSetAuthorityInstruction(
        mintAccount.publicKey,
        wallet.publicKey, // Current authority
        AuthorityType.FreezeAccount,
        null // Setting to null removes authority
      )
    );

    // Set the recent blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = phantomPublicKey;

    // Request Phantom Wallet to sign and send the transaction
    if (wallet.signTransaction) {
      const signedTransaction = await wallet.signTransaction(transaction);

      signedTransaction.partialSign(mintAccount);

      // Send the signed transaction
      const rawTransaction = signedTransaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction);

      // Confirm the transaction
      const confirmation = await connection.confirmTransaction(signature);

      return {
        tokenMintAccount: mintAccount.publicKey.toString(),
        sign: signature,
      };
    } else {
      throw new Error("Wallet does not support signing transactions");
    }
  } catch (error: unknown) {
    console.error("Transaction failed:", error);
  }
};
