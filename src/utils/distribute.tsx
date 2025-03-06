import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

// Solana connection (mainnet or devnet)
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function distributeSOLForFee(wallet: any, wallets: Keypair[]) {
  try {
    // Step 1: Transfer SOL from Phantom to 3 wallets
    const firstWallet = wallets[0];
    const totalSOLToTransfer = 0.1 * 1e9;

    const tx1 = new Transaction();

    tx1.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: firstWallet.publicKey,
        lamports: totalSOLToTransfer,
      })
    );

    try {
      tx1.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx1.feePayer = wallet.publicKey;
      const signedTransaction_init = await wallet.signTransaction(tx1);

      const signature = await connection.sendRawTransaction(
        signedTransaction_init.serialize()
      );
      console.log(`✅ Bundle sent: ${signature}`);
    } catch (error) {
      console.error("Transaction failed:", error);
    }

    await delay(1000);
    // Step 2: Transfer from 3 wallets to 103 wallets equally
    const totalWallets = wallets.length;

    const solPerFinalWallet = Math.floor(totalSOLToTransfer / totalWallets);

    for (const receiver of wallets) {
      const tx2 = new Transaction();
      tx2.add(
        SystemProgram.transfer({
          fromPubkey: firstWallet.publicKey,
          toPubkey: receiver.publicKey,
          lamports: solPerFinalWallet,
        })
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      tx2.recentBlockhash = latestBlockhash.blockhash;

      const transactionSignature = await sendAndConfirmTransaction(
        connection,
        tx2,
        [firstWallet]
      );
      console.log("Transaction Signature:", transactionSignature);

      await delay(300); // Wait 4 seconds before the next transfer
    }

    console.log("Step 2 complete: Distributed to 103 wallets");
  } catch (error) {
    console.error("Error:", error);
  }
}

async function transferSOLFromPhantom(
  from: PublicKey,
  to: PublicKey,
  amountLamports: number,
  wallet: any
) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: amountLamports,
    })
  );

  const latestBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.feePayer = from;

  const signedTx = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  console.log(
    `✅ Transferred ${amountLamports / 1e9} SOL from ${from.toBase58()} to ${to.toBase58()}`
  );
}
async function transferSOL(
  from: PublicKey,
  to: PublicKey,
  amountLamports: number,
  wallet: Keypair
) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: amountLamports,
    })
  );

  const latestBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.feePayer = from;

  const transactionSignature = await sendAndConfirmTransaction(connection, tx, [
    wallet,
  ]);

  console.log(
    `✅ Transferred ${amountLamports / 1e9} SOL from ${from.toBase58()} to ${to.toBase58()}`
  );
}

async function wrapSOL(wallet: Keypair, amount: number) {
  const associatedTokenAccount = await getAssociatedTokenAddress(
    NATIVE_MINT,
    wallet.publicKey
  );

  const wrapTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: associatedTokenAccount,
      lamports: amount, // Convert SOL to WSOL
    }),
    createSyncNativeInstruction(associatedTokenAccount) // Sync the WSOL balance
  );

  const latestBlockhash = await connection.getLatestBlockhash();
  wrapTransaction.recentBlockhash = latestBlockhash.blockhash;
  wrapTransaction.feePayer = wallet.publicKey;
  const transactionSignature = await sendAndConfirmTransaction(
    connection,
    wrapTransaction,
    [wallet]
  );
  console.log(`🔄 Wrapped SOL for ${wallet.publicKey.toBase58()}`);
}

async function execute_wrapping_sol_bundling(
  wallet: any,
  wallets: Keypair[],
  amount: number
) {
  try {
    // Step 1: Transfer SOL from Phantom to First Wallet
    const totalSOLToTransfer = amount; // Example: 0.3 SOL total
    await transferSOLFromPhantom(
      wallet.publicKey,
      wallets[0].publicKey,
      totalSOLToTransfer,
      wallet
    );

    const transaction_fee = 10000;

    // Step 2: Distribute from First Wallet to all 3 wallets equally
    const solPerWallet = Math.floor(totalSOLToTransfer / wallets.length);
    for (const wallet of wallets) {
      await transferSOL(
        wallets[0].publicKey,
        wallet.publicKey,
        solPerWallet,
        wallets[0]
      );
      await delay(300);
    }

    // Step 3: Wrap SOL in each wallet
    for (const wallet of wallets) {
      await wrapSOL(wallet, solPerWallet - transaction_fee);
      await delay(300);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

async function execute_randomly_wrapping_sol(
  wallet: any,
  wallets: Keypair[],
  amount: number
) {
  try {
    // Step 1: Transfer SOL from Phantom to First Wallet
    const totalSOLToTransfer = amount; // Example: 0.3 SOL total
    await transferSOLFromPhantom(
      wallet.publicKey,
      wallets[0].publicKey,
      totalSOLToTransfer,
      wallet
    );

    const transaction_fee = 10000;

    // Step 2: Distribute from First Wallet to all 3 wallets equally
    const distribute = await randomizeDistributionEvenly(
      totalSOLToTransfer,
      wallets.length
    );
    let i = 0;
    for (const wallet of wallets) {
      await transferSOL(
        wallets[0].publicKey,
        wallet.publicKey,
        distribute[i],
        wallets[0]
      );
      i += 1;
      await delay(300);
    }

    let j = 0;
    // Step 3: Wrap SOL in each wallet
    for (const wallet of wallets) {
      await wrapSOL(wallet, distribute[j] - transaction_fee);
      j += 1;
      await delay(300);
    }

    alert("✅ Process completed: SOL transferred & wrapped!");
  } catch (error) {
    console.error("❌ Error:", error);
    alert("Transaction failed!");
  }
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateRandomWalletKeypair(num: number) {
  const wallets: Keypair[] = [];
  for (let i = 0; i < num; i++) {
    const wallet = createRandomWallet();
    wallets.push(wallet);
    console.log(`Wallet ${i + 1}:`, wallet.publicKey.toBase58());
  }
  return wallets;
}

async function initializingATA(wallet: any, wallets: Keypair[], mint: string) {
  for (const wallet of wallets) {
    const associatedTokenAccount_Wsol = await getAssociatedTokenAddress(
      NATIVE_MINT,
      wallet.publicKey
    );
    const associatedTokenAccount_token = await getAssociatedTokenAddress(
      new PublicKey(mint),
      wallet.publicKey
    );
    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, // Payer
        associatedTokenAccount_Wsol, // WSOL account
        wallet.publicKey, // Owner
        NATIVE_MINT // WSOL mint address
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey, // Payer
        associatedTokenAccount_token, // WSOL account
        wallet.publicKey, // Owner
        new PublicKey(mint) // WSOL mint address
      )
    );
    const latestBlockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = wallet.publicKey;
    const transactionSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet]
    );
    await delay(300);
  }
}

function randomizeDistributionEvenly(
  totalTokens: number,
  walletCount: number
): number[] {
  let weights = Array(walletCount)
    .fill(0)
    .map(() => Math.random()); // Generate random weights
  let sumWeights = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.floor((w / sumWeights) * totalTokens)); // Normalize
}

export async function getTokenBalance(wallet: PublicKey, mint: PublicKey) {
  const ata = await getAssociatedTokenAddress(mint, wallet);
  try {
    const account = await getAccount(connection, ata);
    return Number(account.amount); // Token balance
  } catch (e) {
    return 0; // If the account doesn't exist, balance is 0
  }
}

function randomizeDistribution(
  totalTokens: number,
  walletCount: number
): number[] {
  let weights = Array(walletCount)
    .fill(0)
    .map(() => Math.random()); // Generate random weights
  let sumWeights = weights.reduce((a, b) => a + b, 0);

  let distribution = weights.map((w) =>
    Math.floor((w / sumWeights) * totalTokens)
  );

  // Adjust last wallet to ensure exact totalTokens sum
  let sumDistributed = distribution.reduce((a, b) => a + b, 0);
  distribution[walletCount - 1] += totalTokens - sumDistributed;

  return distribution;
}

async function distributeTokens(
  sourceWallets: Keypair[],
  allWallets: Keypair[],
  mint: string
) {
  const TOKEN_MINT: PublicKey = new PublicKey(mint);
  // Fetch total token balances from 3 wallets
  let balances = await Promise.all(
    sourceWallets.map((wallet) => getTokenBalance(wallet.publicKey, TOKEN_MINT))
  );

  // Get total tokens available for distribution
  let totalTokens = balances.reduce((sum, b) => sum + b, 0);
  console.log(`🔹 Total tokens available: ${totalTokens}`);

  // Generate random distribution across 100 wallets
  let tokenDistribution = randomizeDistribution(totalTokens, allWallets.length);
  console.log("🔹 Token distribution before reallocation:", tokenDistribution);

  let currentSourceIndex = 0; // Track which source wallet is sending tokens

  for (let i = 0; i < allWallets.length; i++) {
    let amount = tokenDistribution[i];

    if (amount > 0) {
      let retries = sourceWallets.length; // Allow retrying with different wallets
      while (retries > 0) {
        const sourceWallet = sourceWallets[currentSourceIndex];
        const sourceATA = await getAssociatedTokenAddress(
          TOKEN_MINT,
          sourceWallet.publicKey
        );
        const targetATA = await getAssociatedTokenAddress(
          TOKEN_MINT,
          allWallets[i].publicKey
        );

        // 📌 Check source wallet balance before transferring
        let sourceBalance = await getTokenBalance(
          sourceWallet.publicKey,
          TOKEN_MINT
        );
        if (sourceBalance >= amount) {
          // 📌 Ensure the destination token account exists before transferring
          try {
            await getAccount(connection, targetATA); // Check if the account exists
          } catch (e) {
            console.warn(
              `⚠️ Target wallet ${allWallets[i].publicKey.toBase58()} does not have a token account. Skipping transfer.`
            );
            break; // Skip transfer if token account doesn't exist
          }

          const tx = new Transaction().add(
            createTransferInstruction(
              sourceATA,
              targetATA,
              sourceWallet.publicKey,
              amount
            )
          );

          try {
            await sendAndConfirmTransaction(connection, tx, [sourceWallet]);
            console.log(
              `✅ Transferred ${amount} tokens from ${sourceWallet.publicKey.toBase58()} to ${allWallets[i].publicKey.toBase58()}`
            );
          } catch (error) {
            console.error(`❌ Transfer failed: ${(error as Error).message}`);
          }
          break; // Transfer successful, exit loop
        } else {
          console.warn(
            `❌ Wallet ${sourceWallet.publicKey.toBase58()} has insufficient funds (${sourceBalance}). Trying next wallet.`
          );

          // Try next source wallet
          currentSourceIndex = (currentSourceIndex + 1) % sourceWallets.length;
          retries--;
        }
      }
    }
  }

  console.log("✅ Token distribution completed!");
}
export async function test(wallet: any, mint: string) {
  const wallets = await generateRandomWalletKeypair(10);
  const wallets1: Keypair[] = wallets.slice(0, 3); // First 3 wallets
  const wallets2: Keypair[] = wallets.slice(3);
  await distributeSOLForFee(wallet, wallets);
  await initializingATA(wallet, wallets, mint);
  await execute_wrapping_sol_bundling(wallet, wallets1, 100000000);
  await execute_randomly_wrapping_sol(wallet, wallets2, 100000000);
  console.log("done");
}

function createRandomWallet(): Keypair {
  return Keypair.generate();
}
