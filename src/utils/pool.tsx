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
import { marketIdAtom, vaultsAtom } from "../state/atoms";
import { get_market } from "./market";
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
  market_id: string;
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
    market_id,
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
    "DdHFxFR8mR8yVWwYhK9PHPTHTBJf1xQHTRMhEXGoJC1f"
  );
  const program = new Program(idl as any, contractProgramId, provider);

  try {
    const RAYDIUM_PROGRAM_ID = new PublicKey(
      "HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8"
    ); // Replace with Raydium program ID
    const OPENBOOK_PROGRAM_ID = new PublicKey(
      "EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"
    ); // Replace with OpenBook program ID
    const MARKET_KEY = new PublicKey(market_id); // Replace with OpenBook market key
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
    const [ammLpMintPda, ammLpMintbump] = PublicKey.findProgramAddressSync(
      [
        RAYDIUM_PROGRAM_ID.toBuffer(),
        MARKET_KEY.toBuffer(),
        Buffer.from("lp_mint_associated_seed"),
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
    const [ammTargetOrdersPda, ammTargetOrdersbump] =
      PublicKey.findProgramAddressSync(
        [
          RAYDIUM_PROGRAM_ID.toBuffer(),
          MARKET_KEY.toBuffer(),
          Buffer.from("target_associated_seed"),
        ],
        RAYDIUM_PROGRAM_ID
      );
    const [ammConfigPda, ammConfigbump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_config_account_seed"), // Seed from Rust account
      ],
      RAYDIUM_PROGRAM_ID
    );
    const CREATE_POOL_FEE_ADDRESS_PROGRAM_ID = new PublicKey(
      "3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR"
    );
    const user_token_coin = await getAssociatedTokenAddress(
      COIN_MINT,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const user_token_pc = await getAssociatedTokenAddress(
      PC_MINT,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const user_token_lp = await getAssociatedTokenAddress(
      ammLpMintPda,
      wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const tokenProgram = TOKEN_PROGRAM_ID;
    const associatedTokenProgram = ASSOCIATED_TOKEN_PROGRAM_ID;
    const systemProgram = SystemProgram.programId;
    const rent = new PublicKey("SysvarRent111111111111111111111111111111111");

    console.log(market_id);
    const market_keys = await get_market(market_id);
    console.log(market_keys);

    const MARKET_BIDS_KEY = new PublicKey(market_keys.marketBids);
    const MARKET_ASKS_KEY = new PublicKey(market_keys.marketAsks);
    const MARKET_EVENT_QUEUE_KEY = new PublicKey(market_keys.marketEventQueue);
    const MARKET_COIN_VAULT_KEY = new PublicKey(market_keys.marketCoinVault);
    const MARKET_PC_VAULT_KEY = new PublicKey(market_keys.marketPcVault);
    const MARKET_VAULT_SIGNER_KEY = new PublicKey(
      market_keys.marketVaultSigner
    );

    const open_time = new anchor.BN(Math.floor(Date.now() / 1000));

    const transaction_init = new Transaction();
    transaction_init.add(
      await program.methods
        .initialize(
          ammAuthorityBump,
          open_time,
          new anchor.BN(initialAmount0),
          new anchor.BN(BigInt(initialAmount1) * BigInt(10 ** 6))
        )
        .accounts({
          ammProgram: RAYDIUM_PROGRAM_ID,
          amm: ammPda,
          ammAuthority: ammAuthorityPda,
          ammOpenOrders: ammOpenOrdersPda,
          ammLpMint: ammLpMintPda,
          ammCoinMint: COIN_MINT,
          ammPcMint: PC_MINT,
          ammCoinVault: ammCoinVaultPda,
          ammPcVault: ammPcVaultPda,
          ammTargetOrders: ammTargetOrdersPda,
          ammConfig: ammConfigPda,
          createFeeDestination: CREATE_POOL_FEE_ADDRESS_PROGRAM_ID,
          marketProgram: OPENBOOK_PROGRAM_ID,
          market: MARKET_KEY,
          userWallet: wallet.publicKey,
          userTokenCoin: user_token_coin,
          userTokenPc: user_token_pc,
          userTokenLp: user_token_lp,
          splToken: tokenProgram,
          splAssociatedTokenAccount: associatedTokenProgram,
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

    console.log("Pool initialized successfully. Signature:", signature);

    const max_amount_in_1 = await getTokenBalance(
      bundle_wallets[0].publicKey,
      NATIVE_MINT
    );
    console.log("max_amount_in_1", max_amount_in_1);

    const wallet1_token_coin = await getAssociatedTokenAddress(
      COIN_MINT,
      bundle_wallets[0].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const wallet1_token_pc = await getAssociatedTokenAddress(
      PC_MINT,
      bundle_wallets[0].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction_swap1 = new Transaction();
    transaction_swap1.add(
      await program.methods
        .swapbaseout(
          new anchor.BN(BigInt(max_amount_in_1)),
          new anchor.BN(BigInt(amount_out1))
        )
        .accounts({
          ammProgram: RAYDIUM_PROGRAM_ID,
          ammPool: ammPda,
          ammAuthority: ammAuthorityPda,
          ammOpenOrders: ammOpenOrdersPda,
          ammCoinVault: ammCoinVaultPda,
          ammPcVault: ammPcVaultPda,
          marketProgram: OPENBOOK_PROGRAM_ID,
          market: MARKET_KEY,
          marketBids: MARKET_BIDS_KEY,
          marketAsks: MARKET_ASKS_KEY,
          marketEventQueue: MARKET_EVENT_QUEUE_KEY,
          marketCoinVault: MARKET_COIN_VAULT_KEY,
          marketPcVault: MARKET_PC_VAULT_KEY,
          marketVaultSigner: MARKET_VAULT_SIGNER_KEY,
          userTokenSource: wallet1_token_pc,
          userTokenDestination: wallet1_token_coin,
          userSourceOwner: bundle_wallets[0].publicKey,
          splToken: tokenProgram,
        })
        .instruction()
    );

    const latestBlockhash = await connection.getLatestBlockhash();
    transaction_swap1.recentBlockhash = latestBlockhash.blockhash;
    transaction_swap1.feePayer = bundle_wallets[0].publicKey;

    await transaction_swap1.sign(bundle_wallets[0]);

    const signature_swap1 = await connection.sendRawTransaction(
      transaction_swap1.serialize(),
      { skipPreflight: false, preflightCommitment: "processed" }
    );

    const confirmation = await connection.confirmTransaction(
      signature_swap1,
      "confirmed"
    );

    console.log("Swap1 success. Signature:", signature_swap1);

    const max_amount_in_2 = await getTokenBalance(
      bundle_wallets[1].publicKey,
      NATIVE_MINT
    );
    console.log("max_amount_in_2", max_amount_in_2);

    const wallet2_token_coin = await getAssociatedTokenAddress(
      COIN_MINT,
      bundle_wallets[1].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const wallet2_token_pc = await getAssociatedTokenAddress(
      PC_MINT,
      bundle_wallets[1].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction_swap2 = new Transaction();
    transaction_swap2.add(
      await program.methods
        .swapbaseout(
          new anchor.BN(BigInt(max_amount_in_2)),
          new anchor.BN(BigInt(amount_out2))
        )
        .accounts({
          ammProgram: RAYDIUM_PROGRAM_ID,
          ammPool: ammPda,
          ammAuthority: ammAuthorityPda,
          ammOpenOrders: ammOpenOrdersPda,
          ammCoinVault: ammCoinVaultPda,
          ammPcVault: ammPcVaultPda,
          marketProgram: OPENBOOK_PROGRAM_ID,
          market: MARKET_KEY,
          marketBids: MARKET_BIDS_KEY,
          marketAsks: MARKET_ASKS_KEY,
          marketEventQueue: MARKET_EVENT_QUEUE_KEY,
          marketCoinVault: MARKET_COIN_VAULT_KEY,
          marketPcVault: MARKET_PC_VAULT_KEY,
          marketVaultSigner: MARKET_VAULT_SIGNER_KEY,
          userTokenSource: wallet2_token_pc,
          userTokenDestination: wallet2_token_coin,
          userSourceOwner: bundle_wallets[1].publicKey,
          splToken: tokenProgram,
        })
        .instruction()
    );

    transaction_swap2.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transaction_swap2.feePayer = bundle_wallets[1].publicKey;

    transaction_swap2.sign(bundle_wallets[1]);
    const signature_swap2 = await connection.sendRawTransaction(
      transaction_swap2.serialize()
    );
    await connection.confirmTransaction(signature_swap2);

    console.log("Swap1 success. Signature:", signature_swap2);

    const max_amount_in_3 = await getTokenBalance(
      bundle_wallets[2].publicKey,
      NATIVE_MINT
    );
    console.log("max_amount_in_3", max_amount_in_3);

    const wallet3_token_coin = await getAssociatedTokenAddress(
      COIN_MINT,
      bundle_wallets[2].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const wallet3_token_pc = await getAssociatedTokenAddress(
      PC_MINT,
      bundle_wallets[2].publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction_swap3 = new Transaction();
    transaction_swap3.add(
      await program.methods
        .swapbaseout(
          new anchor.BN(BigInt(max_amount_in_3)),
          new anchor.BN(BigInt(amount_out3))
        )
        .accounts({
          ammProgram: RAYDIUM_PROGRAM_ID,
          ammPool: ammPda,
          ammAuthority: ammAuthorityPda,
          ammOpenOrders: ammOpenOrdersPda,
          ammCoinVault: ammCoinVaultPda,
          ammPcVault: ammPcVaultPda,
          marketProgram: OPENBOOK_PROGRAM_ID,
          market: MARKET_KEY,
          marketBids: MARKET_BIDS_KEY,
          marketAsks: MARKET_ASKS_KEY,
          marketEventQueue: MARKET_EVENT_QUEUE_KEY,
          marketCoinVault: MARKET_COIN_VAULT_KEY,
          marketPcVault: MARKET_PC_VAULT_KEY,
          marketVaultSigner: MARKET_VAULT_SIGNER_KEY,
          userTokenSource: wallet3_token_pc,
          userTokenDestination: wallet3_token_coin,
          userSourceOwner: bundle_wallets[2].publicKey,
          splToken: tokenProgram,
        })
        .instruction()
    );

    transaction_swap3.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transaction_swap3.feePayer = bundle_wallets[2].publicKey;

    transaction_swap3.sign(bundle_wallets[2]);
    const signature_swap3 = await connection.sendRawTransaction(
      transaction_swap3.serialize()
    );
    await connection.confirmTransaction(signature_swap3);

    console.log("Swap1 success. Signature:", signature_swap3);

    const token0Vault_publickey = ammPcVaultPda.toBase58();
    const token1Vault_publickey = ammCoinVaultPda.toBase58();

    store.set(vaultsAtom, {
      token0Vault: token0Vault_publickey,
      token1Vault: token1Vault_publickey,
    });
    store.set(marketIdAtom, market_id);

    return signature_swap3;

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
