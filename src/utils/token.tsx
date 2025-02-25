"use client";
import {
  createSetAuthorityInstruction,
  AuthorityType,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import toast from "react-hot-toast";
import { PinataSDK } from "pinata-web3";
import dotenv from "dotenv";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createFungible,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, percentAmount } from "@metaplex-foundation/umi";
import {
  createTokenIfMissing,
  findAssociatedTokenPda,
  getSplAssociatedTokenProgramId,
  mintTokensTo,
} from "@metaplex-foundation/mpl-toolbox";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
dotenv.config();

export const createNewmint = async (MintDetail: {
  wallet: any;
  amount: number;
  name: string;
  symbol: string;
  description: string;
  image: string;
  twitter: string;
  telegram: string;
  website: string;
}) => {
  try {
    const {
      wallet,
      amount,
      name,
      symbol,
      description,
      image,
      twitter,
      telegram,
      website,
    } = MintDetail;
    // Establish connection to Solana devnet
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    const umi = createUmi("https://api.devnet.solana.com");

    // Register Wallet Adapter to Umi
    umi.use(walletAdapterIdentity(wallet));
    umi.use(mplTokenMetadata());

    const mint = generateSigner(umi);

    console.log("Mint:", mint);
    console.log("Mint Public Key:", mint.publicKey);

    const mintKeypair = Keypair.fromSecretKey(mint.secretKey);

    const pinata = new PinataSDK({
      pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT,
      pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY,
    });

    const metadataJSON = {
      name: name,
      symbol: symbol,
      description: description,
      image: image,
      showName: true,
      twitter: twitter,
      telegram: telegram,
      website: website,
    };

    // Convert JSON to Blob and create a File object
    const metadataBlob = new Blob([JSON.stringify(metadataJSON)], {
      type: "application/json",
    });
    const metadataFile = new File([metadataBlob], "metadata.json", {
      type: "application/json",
    });
    const upload = await pinata.upload.file(metadataFile);

    const metadata = {
      name: name,
      symbol: symbol,
      uri: `https://ipfs.io/ipfs/${upload.IpfsHash}`,
    };

    const createFungibleIx = createFungible(umi, {
      mint: mint,
      name: name,
      uri: metadata.uri, // we use the `metedataUri` variable we created earlier that is storing our uri.
      sellerFeeBasisPoints: percentAmount(0),
      decimals: 6, // set the amount of decimals you want your token to have.
    }).getInstructions()[0];

    const createTokenIx = createTokenIfMissing(umi, {
      mint: mint.publicKey,
      owner: umi.identity.publicKey,
      ataProgram: getSplAssociatedTokenProgramId(umi),
    }).getInstructions()[0];

    const mintTokensIx = mintTokensTo(umi, {
      mint: mint.publicKey,
      token: findAssociatedTokenPda(umi, {
        mint: mint.publicKey,
        owner: umi.identity.publicKey,
      }),
      amount: BigInt(amount),
    }).getInstructions()[0];

    const revokeMintAuthIx = await createSetAuthorityInstruction(
      new PublicKey(mint.publicKey),
      wallet.publicKey, // Current authority
      AuthorityType.MintTokens,
      null, // Setting to null removes authority
      [], // No multisigners
      TOKEN_PROGRAM_ID // Ensure we're using SPL-2022
    );

    const revokeFreezeAuthIx = await createSetAuthorityInstruction(
      new PublicKey(mint.publicKey),
      wallet.publicKey, // Current authority
      AuthorityType.FreezeAccount,
      null, // Setting to null removes authority
      [], // No multisigners
      TOKEN_PROGRAM_ID // Ensure we're using SPL-2022
    );

    const transaction = new Transaction().add(
      toWeb3JsInstruction(createFungibleIx),
      toWeb3JsInstruction(createTokenIx),
      toWeb3JsInstruction(mintTokensIx),
      revokeMintAuthIx,
      revokeFreezeAuthIx
    );

    // Set the recent blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    // Request Phantom Wallet to sign and send the transaction
    if (wallet.signTransaction) {
      const signedTransaction = await wallet.signTransaction(transaction);

      signedTransaction.partialSign(mintKeypair);

      // Send the signed transaction
      const rawTransaction = signedTransaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction);

      // Confirm the transaction
      const confirmation = await connection.confirmTransaction(signature);

      return {
        tokenMintAccount: mint.publicKey,
        sign: signature,
      };
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
