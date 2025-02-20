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
  createInitializeMetadataPointerInstruction,
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  TYPE_SIZE,
  LENGTH_SIZE,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import toast from "react-hot-toast";

export const createNewmint = async (wallet: any, amount: number) => {
  try {
    // Establish connection to Solana devnet
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    );

    // Define the extensions to be used by the mint
    const extensions = [
      ExtensionType.TransferFeeConfig,
      ExtensionType.MetadataPointer,
    ];

    const decimals = 9;
    const feeBasisPoints = 50;
    const maxFee = BigInt(5_000);
    // Generate a new keypair for the mint account
    const mintAccount = Keypair.generate();

    const metadata: TokenMetadata = {
      mint: mintAccount.publicKey,
      name: "Bundle-Coin",
      symbol: "Bundle",
      uri: "https://github.com/saidubundukamara/solana_meta_data/blob/main/metadata.json",
      additionalMetadata: [["description", "Only Possible On Solana"]],
    };

    // Calculate the length of the mint
    const mintLen = getMintLen(extensions);

    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

    const mintLamports = await connection.getMinimumBalanceForRentExemption(
      mintLen + metadataLen
    );

    console.log("Mint Length:", mintLen);
    console.log("Required Lamports:", mintLamports);

    const associatedToken = await getAssociatedTokenAddressSync(
      mintAccount.publicKey,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintAccount.publicKey,
        space: mintLen,
        lamports: mintLamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),

      createInitializeTransferFeeConfigInstruction(
        mintAccount.publicKey,
        wallet.publicKey,
        wallet.publicKey,
        feeBasisPoints,
        maxFee,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMetadataPointerInstruction(
        mintAccount.publicKey,
        wallet.publicKey,
        mintAccount.publicKey,
        TOKEN_2022_PROGRAM_ID
      ),

      createInitializeMintInstruction(
        mintAccount.publicKey,
        decimals,
        wallet.publicKey,
        wallet.publicKey,
        TOKEN_2022_PROGRAM_ID
      ),

      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        mint: mintAccount.publicKey,
        metadata: metadata.mint,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        mintAuthority: wallet.publicKey,
        updateAuthority: wallet.publicKey,
      }),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        associatedToken,
        wallet.publicKey,
        mintAccount.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        mintAccount.publicKey,
        associatedToken,
        wallet.publicKey,
        amount,
        [],
        TOKEN_2022_PROGRAM_ID
      ),
      // 🔹 Revoke Mint Authority
      createSetAuthorityInstruction(
        mintAccount.publicKey,
        wallet.publicKey, // Current authority
        AuthorityType.MintTokens,
        null, // Setting to null removes authority
        [], // No multisigners
        TOKEN_2022_PROGRAM_ID // Ensure we're using SPL-2022
      ),
      // 🔹 Revoke Freeze Authority
      createSetAuthorityInstruction(
        mintAccount.publicKey,
        wallet.publicKey, // Current authority
        AuthorityType.FreezeAccount,
        null, // Setting to null removes authority
        [], // No multisigners
        TOKEN_2022_PROGRAM_ID // Ensure we're using SPL-2022
      )
    );

    // Set the recent blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

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
    if (error instanceof Error) {
      toast.error(error.message);
    } else {
      toast.error("An unknown error occurred");
    }
  }
};
