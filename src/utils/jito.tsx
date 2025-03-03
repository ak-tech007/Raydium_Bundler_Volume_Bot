// import { getKeypairFromEnvironment } from "@solana-developers/helpers";
// import {
//   createMint,
//   createTransferInstruction,
//   getOrCreateAssociatedTokenAccount,
//   mintTo,
// } from "@solana/spl-token";
// import {
//   Connection,
//   Keypair,
//   LAMPORTS_PER_SOL,
//   PublicKey,
//   SystemProgram,
//   Transaction,
// } from "@solana/web3.js";
// import axios from "axios";
// import bs58 from "bs58";
// import "dotenv/config";

// const connection = new Connection("https://api.devnet.solana.com", "confirmed");
// const jitoUrl = process.env.NEXT_PUBLIC_JITO_URL;

// const alice = getKeypairFromEnvironment("ALICE_SECRET_KEY");
// const bob = getKeypairFromEnvironment("BOB_SECRET_KEY");

// async function mintBobTokens() {
//   const mint = await createMint(
//     connection,
//     bob,
//     bob.publicKey,
//     bob.publicKey,
//     6
//   );

//   const bobAta = await getOrCreateAssociatedTokenAccount(
//     connection,
//     bob,
//     mint,
//     bob.publicKey
//   );

//   await mintTo(connection, bob, mint, bobAta.address, bob.publicKey, 100000);

//   return mint;
// }

// async function getTransferLamportsTx(
//   from: Keypair,
//   to: Keypair,
//   lamports: number,
//   blockhash: string
// ) {
//   const tx = new Transaction();
//   tx.add(
//     SystemProgram.transfer({
//       fromPubkey: from.publicKey,
//       toPubkey: to.publicKey,
//       lamports: lamports,
//     })
//   );

//   tx.recentBlockhash = blockhash;
//   tx.sign(from);

//   return tx;
// }

// async function getTransferTokenTx(
//   from: Keypair,
//   to: Keypair,
//   mint: PublicKey,
//   amount: number,
//   blockhash: string
// ) {
//   const tx = new Transaction();
//   const fromAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
//     connection,
//     from,
//     mint,
//     from.publicKey,
//     false,
//     "confirmed"
//   );

//   const toAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
//     connection,
//     from,
//     mint,
//     to.publicKey,
//     false,
//     "confirmed"
//   );

//   tx.add(
//     createTransferInstruction(
//       fromAssociatedTokenAccount.address,
//       toAssociatedTokenAccount.address,
//       from.publicKey,
//       amount
//     )
//   );

//   tx.recentBlockhash = blockhash;
//   tx.sign(from);

//   return tx;
// }

// async function queryJitoBundles(method: string, params: any[]) {
//   try {
//     const response = await axios.post(`${jitoUrl}/bundles`, {
//       jsonrpc: "2.0",
//       id: 1,
//       method,
//       params: [params],
//     });

//     return response.data;
//   } catch (error: any) {
//     const errorData = JSON.stringify(error.response.data);
//     console.error(`Error querying Jito engine: ${errorData}`);
//     return null;
//   }
// }

// async function getJitoTipTransaction(from: Keypair, blockhash: string) {
//   const tx = new Transaction();

//   tx.add(
//     SystemProgram.transfer({
//       fromPubkey: from.publicKey,
//       toPubkey: jitoTipAccountPubkey,
//       lamports: 1000,
//     })
//   );

//   tx.recentBlockhash = blockhash;
//   tx.sign(from);

//   return tx;
// }

// async function main() {
//   const maxRetries = 20;
//   const timeBetweenRetries = 5000;
//   let retryCount = 0;

//   const mint = await mintBobTokens();
//   const { blockhash } = await connection.getLatestBlockhash();

//   const aliceToBobTransferLamportsTx = await getTransferLamportsTx(
//     alice,
//     bob,
//     0.001 * LAMPORTS_PER_SOL,
//     blockhash
//   );

//   const bobToAliceTokenTransferTx = await getTransferTokenTx(
//     bob,
//     alice,
//     mint,
//     100,
//     blockhash
//   );

//   const jitoTipTx = await getJitoTipTransaction(alice, blockhash);

//   const bunldeSentResult = await queryJitoBundles("sendBundle", [
//     bs58.encode(aliceToBobTransferLamportsTx.serialize()),
//     bs58.encode(bobToAliceTokenTransferTx.serialize()),
//     bs58.encode(jitoTipTx.serialize()),
//   ]);

//   console.log(`✅ Bundle sent: ${bunldeSentResult?.result}`);

//   do {
//     const inflightBundleStatus = await queryJitoBundles(
//       "getInflightBundleStatuses",
//       [bunldeSentResult?.result]
//     );

//     const bundleStatus = inflightBundleStatus?.result.value?.[0].status;

//     if (bundleStatus === "Failed") {
//       console.log("❌ JITO bundle failed");
//       return;
//     }

//     if (bundleStatus === "Landed") {
//       console.log("✅ JITO bundle landed");
//       const bundle = await queryJitoBundles("getBundleStatuses", [
//         bunldeSentResult?.result,
//       ]);
//       console.log(`📝 Transactions: ${bundle?.result.value?.[0].transactions}`);
//       return;
//     }

//     console.log(`🔄 JITO bundle status: ${bundleStatus}`);
//     retryCount++;
//     await new Promise((resolve) => setTimeout(resolve, timeBetweenRetries));
//   } while (retryCount < maxRetries);
// }

// main();
