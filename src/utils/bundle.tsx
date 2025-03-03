// import {
//   Connection,
//   Keypair,
//   LAMPORTS_PER_SOL,
//   PublicKey,
//   SystemProgram,
//   Transaction,
//   VersionedTransaction,
// } from "@solana/web3.js";

// import base58 from "bs58";
// import { searcher, bundle } from "jito-ts";
// import { Bundle } from "jito-ts/dist/sdk/block-engine/types";
// import { isError } from "jito-ts/dist/sdk/block-engine/utils";
// import * as dotenv from "dotenv";
// import { buildTx } from "./util";
// dotenv.config();

// const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// // export async function bundle_versioned_trasaction(
// //   txs: VersionedTransaction[],
// //   keypair: Keypair
// // ) {
// //   try {
// //     const txNum = Math.ceil(txs.length / 4);
// //     let successNum = 0;

// //     for (let i = 0; i < txNum; i++) {
// //       const upperIndex = (i + 1) * 3;
// //       const downIndex = i * 3;
// //       const newTxs: VersionedTransaction[] = [];

// //       for (let j = downIndex; j < upperIndex; j++) {
// //         if (txs[j]) newTxs.push(txs[j]);
// //       }

// //       const success = await bull_dozer(newTxs, keypair);
// //       if (success) successNum++; // Increment success counter if the batch succeeds
// //     }

// //     return successNum === txNum; // Return true if all batches succeed
// //   } catch (error) {
// //     console.error("Error in bundle function:", error);
// //     return false;
// //   }
// // }

// // export async function bull_dozer(
// //   txs: VersionedTransaction[],
// //   keypair: Keypair
// // ) {
// //   try {
// //     const bundleTransactionLimit = parseInt("4");
// //     const jitoKey = Keypair.fromSecretKey(
// //       base58.decode(process.env.NEXT_PUBLIC_JITO_AUTH_KEYPAIR || "")
// //     );
// //     const blockEngineUrl = process.env.NEXT_PUBLIC_BLOCK_ENGINE_URL_TESTNET;
// //     if (!blockEngineUrl) {
// //       throw new Error("NEXT_PUBLIC_BLOCK_ENGINE_URL_TESTNET is not defined");
// //     }
// //     const search = searcher.searcherClient(blockEngineUrl, jitoKey);

// //     await build_bundle(search, bundleTransactionLimit, txs, keypair);
// //     const bundle_result = await onBundleResult(search);
// //     return bundle_result;
// //   } catch (error) {
// //     return 0;
// //   }
// // }

// // async function build_bundle(
// //   search: searcher.SearcherClient,
// //   bundleTransactionLimit: number,
// //   txs: VersionedTransaction[],
// //   keypair: Keypair
// // ) {
// //   const tipAccountsResult = await search.getTipAccounts();
// //   const _tipAccount = new PublicKey(
// //     tipAccountsResult[Math.floor(Math.random() * tipAccountsResult.length)]
// //   );
// //   const tipAccount = new PublicKey(_tipAccount);

// //   const bund = new Bundle([], bundleTransactionLimit);
// //   const resp = await connection.getLatestBlockhash("processed");
// //   bund.addTransactions(...txs);

// //   let maybeBundle = bund.addTipTx(
// //     keypair,
// //     Number(1000000 / LAMPORTS_PER_SOL),
// //     tipAccount,
// //     resp.blockhash
// //   );

// //   if (isError(maybeBundle)) {
// //     throw maybeBundle;
// //   }
// //   try {
// //     await search.sendBundle(maybeBundle);
// //   } catch (e) {}
// //   return maybeBundle;
// // }

// // export const onBundleResult = (c: searcher.SearcherClient): Promise<number> => {
// //   let first = 0;
// //   let isResolved = false;

// //   return new Promise((resolve) => {
// //     // Set a timeout to reject the promise if no bundle is accepted within 5 seconds
// //     setTimeout(() => {
// //       resolve(first);
// //       isResolved = true;
// //     }, 30000);

// //     c.onBundleResult(
// //       (result: any) => {
// //         if (isResolved) return first;
// //         // clearTimeout(timeout) // Clear the timeout if a bundle is accepted
// //         const isAccepted = result.accepted;
// //         const isRejected = result.rejected;
// //         if (isResolved == false) {
// //           if (isAccepted) {
// //             // console.log(`bundle accepted, ID: ${result.bundleId}  | Slot: ${result.accepted!.slot}`)
// //             first += 1;
// //             isResolved = true;
// //             resolve(first); // Resolve with 'first' when a bundle is accepted
// //           }
// //           if (isRejected) {
// //             // Do not resolve or reject the promise here
// //           }
// //         }
// //       },
// //       (e: any) => {
// //         // Do not reject the promise here
// //       }
// //     );
// //   });
// // };

// const getRandomeTipAccountAddress = async (
//   searcherClient: searcher.SearcherClient
// ) => {
//   const account = await searcherClient.getTipAccounts();
//   return new PublicKey(account[Math.floor(Math.random() * account.length)]);
// };

// export const bundle_versioned_transactions = async (
//   txs: VersionedTransaction[],
//   keypair: Keypair
// ) => {
//   const bundleTransactionLimit = parseInt(
//     process.env.BUNDLE_TRANSACTION_LIMIT || "5"
//   );

//   const blockEngineUrl = process.env.NEXT_PUBLIC_BLOCK_ENGINE_URL_TESTNET || "";

//   // Create the searcher client that will interact with Jito
//   const searcherClient = searcher.searcherClient(blockEngineUrl);
//   // Subscribe to the bundle result
//   searcherClient.onBundleResult(
//     (result) => {
//       console.log("received bundle result:", result);
//     },
//     (e) => {
//       throw e;
//     }
//   );

//   const tipAccount = await getRandomeTipAccountAddress(searcherClient);
//   console.log("tip account:", tipAccount);

//   // get the latest blockhash
//   const connection = new Connection(
//     "https://api.devnet.solana.com",
//     "confirmed"
//   );

//   const blockHash = await connection.getLatestBlockhash();
//   // Build and sign a tip transaction
//   const tipIx = SystemProgram.transfer({
//     fromPubkey: keypair.publicKey,
//     toPubkey: tipAccount,
//     lamports: 1000, // tip amount
//   });
//   const transaction_tip = new Transaction();
//   transaction_tip.add(tipIx);
//   const versionedTx_Tip = await buildTx(
//     connection,
//     transaction_tip,
//     keypair.publicKey,
//     [keypair]
//   );

//   const jitoBundle = new bundle.Bundle(
//     [...txs, versionedTx_Tip],
//     bundleTransactionLimit
//   );

//   try {
//     const resp = await searcherClient.sendBundle(jitoBundle);
//     console.log("resp:", resp);
//   } catch (e) {
//     console.error("error sending bundle:", e);
//   }
// };
