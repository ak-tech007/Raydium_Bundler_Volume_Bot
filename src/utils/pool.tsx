import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import dotenv from "dotenv";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAccount,
} from "@solana/spl-token";
import { SendTransactionError } from "@solana/web3.js";
import { Program } from "@project-serum/anchor";
import idl from "../app/_idl/initialize_pool.json";
import axios from "axios";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { delay, getTokenBalance, saveWalletsToFile } from "./distribute";
const jitoUrl = process.env.NEXT_PUBLIC_JITO_URL;
import { getDefaultStore } from "jotai";
import { vaultsAtom } from "../state/atoms";
const store = getDefaultStore();

dotenv.config();
const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_URL || "",
  "confirmed"
);

export const initializeAndSwap = async (InitialAndSwapDetails: {
  wallet: any;
  mint: string;
  initialAmount0: number;
  initialAmount1: number;
  amount_out1: number;
  amount_out2: number;
  amount_out3: number;
  jito_fee: number;
  bundle_wallets_privatekey: string[];
}) => {
  const {
    wallet,
    mint,
    initialAmount0,
    initialAmount1,
    amount_out1,
    amount_out2,
    amount_out3,
    jito_fee,
    bundle_wallets_privatekey,
  } = InitialAndSwapDetails;

  let bundle_wallets: Keypair[] = [];
  bundle_wallets_privatekey.forEach((wallet) => {
    const wallet_ = Keypair.fromSecretKey(bs58.decode(wallet));
    bundle_wallets.push(wallet_);
  });

  const provider = new anchor.AnchorProvider(
    connection,
    wallet as any,
    anchor.AnchorProvider.defaultOptions()
  );

  const contractProgramId = new PublicKey(
    "5nkUCxN2iFukZkE5yk2Z4HTxrPdwHZMmZskGzWcAfr1F"
  );
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
      filters: [{ dataSize: 236 }], // Data size of AmmConfig struct
    });
    if (ammConfig.length === 0) {
      throw new Error("No ammConfig account found.");
    }

    const ammConfigAccount = ammConfig[0]; // Get the first account
    const authority = await PublicKey.findProgramAddressSync(
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
    const [token1Vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), poolState.toBuffer(), token1Mint.toBuffer()],
      programId
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

    const open_time = new anchor.BN(Math.floor(Date.now() / 1000));

    // Create and sign transactions
    const transaction_init = new Transaction();
    transaction_init.add(
      await program.methods
        .initializeNewPool(
          new anchor.BN(initialAmount0),
          new anchor.BN(BigInt(initialAmount1) * BigInt(10 ** 6)),
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
        .instruction()
    );
    transaction_init.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transaction_init.feePayer = wallet.publicKey;
    const signedTransaction_init =
      await wallet.signTransaction(transaction_init);

    const signature = await connection.sendRawTransaction(
      signedTransaction_init.serialize()
    );
    await connection.confirmTransaction(signature);

    console.log("initializing pool signature", signature);

    const max_amount_in_1 = await getTokenBalance(
      bundle_wallets[0].publicKey,
      NATIVE_MINT
    );
    console.log("max_amount_in_1", max_amount_in_1);

    const inputTokenAccount1 = await getAssociatedTokenAddress(
      token0Mint,
      bundle_wallets[0].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const outputTokenAccount1 = await getAssociatedTokenAddress(
      token1Mint,
      bundle_wallets[0].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const inputTokenAccountInfo =
      await connection.getAccountInfo(inputTokenAccount1);
    if (!inputTokenAccountInfo) {
      console.error("🚨 inputTokenAccount1 is not initialized!");
    }

    const poolStateInfo = await connection.getAccountInfo(poolState);
    if (!poolStateInfo) {
      throw new Error("🚨 Pool state account is NOT initialized!");
    } else {
      console.log("✅ Pool state is initialized:", poolStateInfo);
    }
    const poolStateData = await program.account.poolState.fetch(poolState);
    console.log("🔍 Pool State Data:", poolStateData);
    const vaultInfo = await connection.getAccountInfo(token0Vault);
    if (!vaultInfo) {
      console.error("🚨 Error: Vault account does NOT exist!");
    }
    const vaultAccountInfo = await getAccount(connection, token0Vault);
    console.log("✅ Vault Balance:", vaultAccountInfo.amount.toString());

    const transaction_swap1 = new Transaction();
    transaction_swap1.add(
      await program.methods
        .swapBaseOut(
          new anchor.BN(BigInt(max_amount_in_1)),
          new anchor.BN(BigInt(amount_out1) * BigInt(10 ** 6))
        )
        .accounts({
          cpSwapProgram: programId,
          payer: bundle_wallets[0].publicKey,
          authority: authority,
          ammConfig: ammConfigAccount.pubkey,
          poolState: poolState,
          inputTokenAccount: inputTokenAccount1,
          outputTokenAccount: outputTokenAccount1,
          inputVault: token0Vault,
          outputVault: token1Vault,
          inputTokenProgram: token0Program,
          outputTokenProgram: token1Program,
          inputTokenMint: token0Mint,
          outputTokenMint: token1Mint,
          observationState: observationState,
        })
        .instruction()
    );
    transaction_swap1.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transaction_swap1.feePayer = bundle_wallets[0].publicKey;
    try {
      transaction_swap1.sign(bundle_wallets[0]);
      const signature1 = await connection.sendRawTransaction(
        transaction_swap1.serialize()
      );

      console.log(`✅ Transaction Sent: ${signature1}`);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(
        signature1,
        "confirmed"
      );
    } catch (error: any) {
      console.error("❌ Transaction Failed:", error);

      // Check if the error contains logs
      if (error.logs) {
        console.error("🔍 Logs:", error.logs);
      }

      if (error.message.includes("Simulation failed")) {
        console.error(
          "⚠️ Transaction simulation failed. Check if the wallet has enough balance."
        );
      }

      if (error.message.includes("0x1770")) {
        console.error(
          "🚨 Error 0x1770: SwapBaseOut transaction was not approved."
        );
      }
    }

    const max_amount_in_2 = await getTokenBalance(
      bundle_wallets[1].publicKey,
      NATIVE_MINT
    );

    console.log("max_amount_in_2", max_amount_in_2);
    const inputTokenAccount2 = await getAssociatedTokenAddress(
      token0Mint,
      bundle_wallets[1].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const outputTokenAccount2 = await getAssociatedTokenAddress(
      token1Mint,
      bundle_wallets[1].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction_swap2 = new Transaction();
    transaction_swap2.add(
      await program.methods
        .swapBaseOut(
          new anchor.BN(BigInt(max_amount_in_2)),
          new anchor.BN(BigInt(amount_out2) * BigInt(10 ** 6))
        )
        .accounts({
          cpSwapProgram: programId,
          payer: bundle_wallets[1].publicKey,
          authority: authority,
          ammConfig: ammConfigAccount.pubkey,
          poolState: poolState,
          inputTokenAccount: inputTokenAccount2,
          outputTokenAccount: outputTokenAccount2,
          inputVault: token0Vault,
          outputVault: token1Vault,
          inputTokenProgram: token0Program,
          outputTokenProgram: token1Program,
          inputTokenMint: token0Mint,
          outputTokenMint: token1Mint,
          observationState: observationState,
        })
        .instruction()
    );
    transaction_swap2.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transaction_swap2.feePayer = bundle_wallets[1].publicKey;
    transaction_swap2.sign(bundle_wallets[1]);
    const signature2 = await connection.sendRawTransaction(
      transaction_swap2.serialize()
    );
    await connection.confirmTransaction(signature2);

    const max_amount_in_3 = await getTokenBalance(
      bundle_wallets[2].publicKey,
      NATIVE_MINT
    );

    console.log("max_amount_in_3", max_amount_in_3);
    const inputTokenAccount3 = await getAssociatedTokenAddress(
      token0Mint,
      bundle_wallets[2].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const outputTokenAccount3 = await getAssociatedTokenAddress(
      token1Mint,
      bundle_wallets[2].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction_swap3 = new Transaction();
    transaction_swap3.add(
      await program.methods
        .swapBaseOut(
          new anchor.BN(BigInt(max_amount_in_3)),
          new anchor.BN(BigInt(amount_out3) * BigInt(10 ** 6))
        )
        .accounts({
          cpSwapProgram: programId,
          payer: bundle_wallets[2].publicKey,
          authority: authority,
          ammConfig: ammConfigAccount.pubkey,
          poolState: poolState,
          inputTokenAccount: inputTokenAccount3,
          outputTokenAccount: outputTokenAccount3,
          inputVault: token0Vault,
          outputVault: token1Vault,
          inputTokenProgram: token0Program,
          outputTokenProgram: token1Program,
          inputTokenMint: token0Mint,
          outputTokenMint: token1Mint,
          observationState: observationState,
        })
        .instruction()
    );
    transaction_swap3.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transaction_swap3.feePayer = bundle_wallets[2].publicKey;
    transaction_swap3.sign(bundle_wallets[2]);
    const signature3 = await connection.sendRawTransaction(
      transaction_swap3.serialize()
    );
    await connection.confirmTransaction(signature3);

    const token0Vault_publickey = token0Vault.toBase58();
    const token1Vault_publickey = token1Vault.toBase58();

    store.set(vaultsAtom, {
      token0Vault: token0Vault_publickey,
      token1Vault: token1Vault_publickey,
    });

    return signature3;

    // const jitoTipAddress = await getJitoTipAccount();

    // const tipIx = SystemProgram.transfer({
    //   fromPubkey: wallet.publicKey,
    //   toPubkey: jitoTipAddress,
    //   lamports: jito_fee, // tip amount
    // });

    // const transaction_jitoTip = new Transaction().add(tipIx);
    // transaction_jitoTip.recentBlockhash = (
    //   await connection.getLatestBlockhash()
    // ).blockhash;
    // transaction_jitoTip.feePayer = wallet.publicKey;
    // const transaction_jitoTip_ =
    //   await wallet.signTransaction(transaction_jitoTip);

    // const bunldeSentResult = await queryJitoBundles("sendBundle", [
    //   bs58.encode(signedTransaction_init.serialize()),
    //   bs58.encode(transaction_swap1.serialize()),
    //   bs58.encode(transaction_swap2.serialize()),
    //   bs58.encode(transaction_swap3.serialize()),
    //   bs58.encode(transaction_jitoTip_.serialize()),
    // ]);

    // console.log(`✅ Bundle sent: ${bunldeSentResult?.result}`);

    // let retryCount = 0;
    // const timeBetweenRetries = 5000;
    // const maxRetries = 20;

    // do {
    //   const inflightBundleStatus = await queryInflightBundleStatuses(
    //     "getInflightBundleStatuses",
    //     [bunldeSentResult?.result]
    //   );

    //   const bundleStatus = inflightBundleStatus?.result.value?.[0].status;

    //   if (bundleStatus === "Failed") {
    //     console.log("❌ JITO bundle failed");
    //     return "Failed";
    //   }

    //   if (bundleStatus === "Landed") {
    //     console.log("✅ JITO bundle landed");
    //     const bundle = await queryBundleStatuses("getBundleStatuses", [
    //       bunldeSentResult?.result,
    //     ]);
    //     console.log(
    //       `📝 Transactions: ${bundle?.result.value?.[0].transactions}`
    //     );

    //     return bundle?.result.value?.[0].transactions;
    //   }

    //   console.log(`🔄 JITO bundle status: ${bundleStatus}`);
    //   retryCount++;
    //   await new Promise((resolve) => setTimeout(resolve, timeBetweenRetries));
    // } while (retryCount < maxRetries);

    // return "Failed";
  } catch (error) {
    if (error instanceof SendTransactionError) {
      console.error("Transaction failed:", error.message);
    } else {
      console.error("Unexpected error:", error);
    }
    throw error;
  }
};

async function queryJitoBundles(method: string, params: any[]) {
  try {
    const response = await axios.post(`${jitoUrl}/bundles`, {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: [params],
    });

    return response.data;
  } catch (error: any) {
    const errorData = JSON.stringify(error.response.data);
    console.error(`Error querying Jito engine: ${errorData}`);
    return null;
  }
}

async function queryInflightBundleStatuses(method: string, params: any[]) {
  try {
    const response = await axios.post(`${jitoUrl}/getInflightBundleStatuses`, {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: [params],
    });

    return response.data;
  } catch (error: any) {
    const errorData = JSON.stringify(error.response.data);
    console.error(`Error querying Jito engine: ${errorData}`);
    return null;
  }
}

async function queryBundleStatuses(method: string, params: any[]) {
  try {
    const response = await axios.post(`${jitoUrl}/getBundleStatuses`, {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: [params],
    });

    return response.data;
  } catch (error: any) {
    const errorData = JSON.stringify(error.response.data);
    console.error(`Error querying Jito engine: ${errorData}`);
    return null;
  }
}

async function getJitoTipAccount() {
  const accounts = await queryJitoBundles("getTipAccounts", []);
  const jitoTipAddress = new PublicKey(
    accounts?.result[Math.floor(Math.random() * accounts?.result.length)]
  );

  return jitoTipAddress;
}
