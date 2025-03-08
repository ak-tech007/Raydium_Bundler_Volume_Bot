import {
  walletsForAllAtom,
  walletsForBundlingAtom,
  walletsForRemainingAtom,
} from "@/state/atoms";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
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
import { getDefaultStore } from "jotai";

const store = getDefaultStore();

// Solana connection (mainnet or devnet)
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function distributeSOLForFee(wallet: any, wallets: Keypair[]) {
  try {
    // Step 1: Transfer SOL from Phantom to 3 wallets
    const firstWallet = wallets[0];
    const totalSOLToTransfer = 0.1 * 1e9;

    await transferSOLFromPhantom(
      wallet.publicKey,
      firstWallet.publicKey,
      totalSOLToTransfer,
      wallet
    );

    // Step 2: Transfer from 3 wallets to 103 wallets equally
    const totalWallets = wallets.length;

    const solPerFinalWallet = Math.floor(totalSOLToTransfer / totalWallets);
    const minFee = 10000;

    for (const receiver of wallets) {
      const balance = await connection.getBalance(firstWallet.publicKey);

      // If balance is too low, request SOL from Phantom wallet
      if (balance < minFee) {
        const topUpAmount = minFee - balance + 10000; // Send a bit extra to avoid issues
        await transferSOLFromPhantom(
          wallet.publicKey,
          firstWallet.publicKey,
          topUpAmount,
          wallet
        );
      }

      await transferSOL(
        firstWallet.publicKey,
        receiver.publicKey,
        solPerFinalWallet,
        firstWallet
      );
    }

    console.log(`Step 2 complete: Distributed to ${totalWallets} wallets`);
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
  const maxRetries = 3; // Maximum retry attempts
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(
        `🔄 Attempt ${attempt + 1}: Transferring ${amountLamports / 1e9} SOL from ${from.toBase58()} to ${to.toBase58()}...`
      );

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
      const signature = await connection.sendRawTransaction(
        signedTx.serialize()
      );
      await connection.confirmTransaction(signature, "confirmed");

      console.log(
        `✅ Successfully transferred ${amountLamports / 1e9} SOL from ${from.toBase58()} to ${to.toBase58()} (Tx: ${signature})`
      );
      return; // Exit on success
    } catch (error) {
      console.error(
        `❌ Attempt ${attempt + 1} failed for transfer from ${from.toBase58()} to ${to.toBase58()}:`,
        error
      );

      attempt++;
      if (attempt < maxRetries) {
        console.log(`🔁 Retrying... (${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 sec before retrying
      } else {
        console.error(
          `❌ All ${maxRetries} attempts failed for transfer from ${from.toBase58()} to ${to.toBase58()}`
        );
      }
    }
  }
}

async function transferSOL(
  from: PublicKey,
  to: PublicKey,
  amountLamports: number,
  wallet: Keypair
) {
  const maxRetries = 3; // Maximum retry attempts
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(
        `🔄 Attempt ${attempt + 1}: Transferring ${amountLamports / 1e9} SOL from ${from.toBase58()} to ${to.toBase58()}...`
      );

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
      tx.sign(wallet);

      const signature = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(signature, "confirmed");

      console.log(
        `✅ Successfully transferred ${amountLamports / 1e9} SOL from ${from.toBase58()} to ${to.toBase58()} (Tx: ${signature})`
      );
      return; // Exit on success
    } catch (error) {
      console.error(
        `❌ Attempt ${attempt + 1} failed for transfer from ${from.toBase58()} to ${to.toBase58()}:`,
        error
      );

      attempt++;
      if (attempt < maxRetries) {
        console.log(`🔁 Retrying... (${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 sec before retrying
      } else {
        console.error(
          `❌ All ${maxRetries} attempts failed for transfer from ${from.toBase58()} to ${to.toBase58()}`
        );
      }
    }
  }
}

async function wrapSOL(wallet: Keypair, amount: number) {
  const associatedTokenAccount = await getAssociatedTokenAddress(
    NATIVE_MINT,
    wallet.publicKey
  );

  const maxRetries = 3; // Maximum retry attempts
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(
        `🔄 Attempt ${attempt + 1}: Wrapping ${amount / 1e9} SOL for ${wallet.publicKey.toBase58()}...`
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
      wrapTransaction.sign(wallet);

      const signature = await connection.sendRawTransaction(
        wrapTransaction.serialize()
      );
      await connection.confirmTransaction(signature, "confirmed");

      console.log(
        `✅ Wrapped ${amount / 1e9} SOL for ${wallet.publicKey.toBase58()} (Tx: ${signature})`
      );
      return; // Exit on success
    } catch (error) {
      console.error(
        `❌ Attempt ${attempt + 1} failed for ${wallet.publicKey.toBase58()}:`,
        error
      );

      attempt++;
      if (attempt < maxRetries) {
        console.log(`🔁 Retrying... (${attempt}/${maxRetries})`);
        await delay(500); // Wait 2 sec before retrying
      } else {
        console.error(
          `❌ All ${maxRetries} attempts failed for ${wallet.publicKey.toBase58()}`
        );
      }
    }
  }
}

async function unwrapSOL(wallet: Keypair) {
  const wsolAccount = await getAssociatedTokenAddress(
    NATIVE_MINT,
    wallet.publicKey
  );
  const maxRetries = 3; // Maximum retry attempts
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(
        `🔄 Attempt ${attempt + 1}: Closing WSOL for ${wallet.publicKey.toBase58()}...`
      );

      const tx = new Transaction().add(
        createCloseAccountInstruction(
          wsolAccount,
          wallet.publicKey,
          wallet.publicKey
        )
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = wallet.publicKey;
      tx.sign(wallet);

      const signature = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(signature, "confirmed");

      console.log(
        `✅ Closed WSOL for ${wallet.publicKey.toBase58()} (Tx: ${signature})`
      );
      return; // Exit function on success
    } catch (error) {
      console.error(
        `❌ Attempt ${attempt + 1} failed for ${wallet.publicKey.toBase58()}:`,
        error
      );

      attempt++;
      if (attempt < maxRetries) {
        console.log(`🔁 Retrying... (${attempt}/${maxRetries})`);
        await delay(500); // Wait 2 sec before retrying
      } else {
        console.error(
          `❌ All ${maxRetries} attempts failed for ${wallet.publicKey.toBase58()}`
        );
      }
    }
  }
}

async function execute_wrapping_sol_bundling(
  phantom: any,
  wallets: Keypair[],
  amount: number
) {
  try {
    // Step 1: Transfer SOL from Phantom to First Wallet
    const totalSOLToTransfer = amount; // Example: 0.3 SOL total
    await transferSOLFromPhantom(
      phantom.publicKey,
      wallets[0].publicKey,
      totalSOLToTransfer,
      phantom
    );

    const transaction_fee = 10000;

    // Step 2: Distribute from First Wallet to all 3 wallets equally
    const solPerWallet = Math.floor(totalSOLToTransfer / wallets.length);
    for (const wallet of wallets) {
      const balance = await connection.getBalance(wallets[0].publicKey);

      // If balance is too low, request SOL from Phantom wallet
      if (balance < transaction_fee) {
        const topUpAmount = transaction_fee - balance + 10000; // Send a bit extra to avoid issues
        await transferSOLFromPhantom(
          phantom.publicKey,
          wallets[0].publicKey,
          topUpAmount,
          phantom
        );
      }
      await transferSOL(
        wallets[0].publicKey,
        wallet.publicKey,
        solPerWallet,
        wallets[0]
      );
    }

    // Step 3: Wrap SOL in each wallet
    for (const wallet of wallets) {
      await wrapSOL(wallet, solPerWallet);
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

async function execute_randomly_wrapping_sol(
  phantom: any,
  wallets: Keypair[],
  amount: number
) {
  try {
    // Step 1: Transfer SOL from Phantom to First Wallet
    const totalSOLToTransfer = amount; // Example: 0.3 SOL total
    await transferSOLFromPhantom(
      phantom.publicKey,
      wallets[0].publicKey,
      totalSOLToTransfer,
      phantom
    );

    // Step 2: Distribute from First Wallet to all 3 wallets equally
    const distribute = await randomizeDistribution(
      totalSOLToTransfer,
      wallets.length
    );
    const minFee = 10000;
    let i = 0;
    for (const wallet of wallets) {
      const balance = await connection.getBalance(wallets[0].publicKey);

      // If balance is too low, request SOL from Phantom wallet
      if (balance < minFee) {
        const topUpAmount = minFee - balance + 10000; // Send a bit extra to avoid issues
        await transferSOLFromPhantom(
          phantom.publicKey,
          wallets[0].publicKey,
          topUpAmount,
          phantom
        );
      }
      await transferSOL(
        wallets[0].publicKey,
        wallet.publicKey,
        distribute[i],
        wallets[0]
      );
      i += 1;
    }

    let j = 0;
    // Step 3: Wrap SOL in each wallet
    for (const wallet of wallets) {
      const balance = await connection.getBalance(wallets[0].publicKey);

      // If balance is too low, request SOL from Phantom wallet
      if (balance < minFee) {
        const topUpAmount = minFee - balance + 10000; // Send a bit extra to avoid issues
        await transferSOLFromPhantom(
          phantom.publicKey,
          wallets[0].publicKey,
          topUpAmount,
          phantom
        );
      }
      await wrapSOL(wallet, distribute[j]);
      j += 1;
    }

    console.log("✅ Process completed: SOL transferred & wrapped!");
  } catch (error) {
    console.error("❌ Error:", error);
    alert("Transaction failed!");
  }
}

export async function delay(ms: number) {
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

async function initializingATA(wallets: Keypair[], mint: string, phantom: any) {
  const minFee = 10000;
  for (const wallet of wallets) {
    const associatedTokenAccount_Wsol = await getAssociatedTokenAddress(
      NATIVE_MINT,
      wallet.publicKey
    );
    const associatedTokenAccount_token = await getAssociatedTokenAddress(
      new PublicKey(mint),
      wallet.publicKey
    );
    const balance = await connection.getBalance(wallet.publicKey);

    // If balance is too low, request SOL from Phantom wallet
    if (balance < minFee) {
      const topUpAmount = minFee - balance + 10000; // Send a bit extra to avoid issues
      await transferSOLFromPhantom(
        phantom.publicKey,
        wallet.publicKey,
        topUpAmount,
        phantom
      );
    }
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
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );
    await connection.confirmTransaction(signature, "confirmed");
  }
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

async function transferTokenFromWalletToWallet(
  from: Keypair,
  to: Keypair,
  token: PublicKey,
  amount: number
) {
  const sourceATA = await getAssociatedTokenAddress(token, from.publicKey);
  const targetATA = await getAssociatedTokenAddress(token, to.publicKey);
  const tx = new Transaction().add(
    createTransferInstruction(sourceATA, targetATA, from.publicKey, amount)
  );

  try {
    const latestBlockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = from.publicKey;

    await tx.sign(from);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, "confirmed");
    console.log(
      `✅ Transferred ${amount} tokens from ${from.publicKey.toBase58()} to ${to.publicKey.toBase58()}`
    );
  } catch (error) {
    console.error(`❌ Transfer failed: ${(error as Error).message}`);
  }
}

export async function distributeTokens(
  sourceWallets: Keypair[],
  allWallets: Keypair[],
  mint: string,
  phantom: any
) {
  const TOKEN_MINT: PublicKey = new PublicKey(mint);
  // Fetch total token balances from 3 wallets
  let balances = await Promise.all(
    sourceWallets.map((wallet) => getTokenBalance(wallet.publicKey, TOKEN_MINT))
  );
  console.log(balances);

  // Get total tokens available for distribution
  let totalTokens = balances.reduce((sum, b) => sum + b, 0);
  console.log(`🔹 Total tokens available: ${totalTokens}`);

  // Generate random distribution across 100 wallets
  let tokenDistribution = randomizeDistribution(totalTokens, allWallets.length);
  console.log("🔹 Token distribution before reallocation:", tokenDistribution);
  let currentSourceIndex = 0; // Track which source wallet is sending tokens
  const minFee = 10000;
  for (let i = 0; i < allWallets.length; i++) {
    let amount = tokenDistribution[i];

    if (amount > 0) {
      let retries = sourceWallets.length; // Allow retrying with different wallets
      while (retries > 0) {
        const sourceWallet = sourceWallets[currentSourceIndex];

        // 📌 Check source wallet balance before transferring
        let sourceBalance = await getTokenBalance(
          sourceWallet.publicKey,
          TOKEN_MINT
        );
        if (sourceBalance >= amount) {
          // 📌 Ensure the destination token account exists before transferring

          const balance = await connection.getBalance(sourceWallet.publicKey);

          // If balance is too low, request SOL from Phantom wallet
          if (balance < minFee) {
            const topUpAmount = minFee - balance + 10000; // Send a bit extra to avoid issues
            await transferSOLFromPhantom(
              phantom.publicKey,
              sourceWallet.publicKey,
              topUpAmount,
              phantom
            );
          }
          await transferTokenFromWalletToWallet(
            sourceWallet,
            allWallets[i],
            TOKEN_MINT,
            amount
          );
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

function createRandomWallet(): Keypair {
  return Keypair.generate();
}

export async function unwrapAllWSOL(wallets: Keypair[], phantom: any) {
  const minFee = 10000;
  for (const wallet of wallets) {
    const balance = await connection.getBalance(wallet.publicKey);

    // If balance is too low, request SOL from Phantom wallet
    if (balance < minFee) {
      const topUpAmount = minFee - balance + 10000; // Send a bit extra to avoid issues
      await transferSOLFromPhantom(
        phantom.publicKey,
        wallet.publicKey,
        topUpAmount,
        phantom
      );
    }
    await unwrapSOL(wallet);
  }
}

export async function withdrawSOL(wallets: Keypair[], phantom: any) {
  for (const wallet of wallets) {
    const balance = await connection.getBalance(wallet.publicKey);

    if (balance > 5000) {
      let success = false;
      let attempts = 0;
      const maxAttempts = 3; // Set max retry attempts

      while (!success && attempts < maxAttempts) {
        try {
          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: wallet.publicKey,
              toPubkey: phantom.publicKey,
              lamports: balance - 5000, // Keep 5000 lamports to avoid rent exemption issues
            })
          );

          const latestBlockhash = await connection.getLatestBlockhash();
          tx.recentBlockhash = latestBlockhash.blockhash;
          tx.feePayer = wallet.publicKey;
          tx.sign(wallet);
          const signature = await connection.sendRawTransaction(tx.serialize());
          await connection.confirmTransaction(signature, "confirmed");

          console.log(
            `✅ Sent ${balance / 1e9} SOL from ${wallet.publicKey.toBase58()} -> ${phantom.publicKey.toBase58()} (Tx: ${signature})`
          );

          success = true; // Mark as successful
        } catch (error) {
          attempts++;
          console.error(
            `❌ Error withdrawing from ${wallet.publicKey.toBase58()} (Attempt ${attempts}):`,
            error
          );

          if (attempts >= maxAttempts) {
            console.error(
              `❌ Skipping ${wallet.publicKey.toBase58()} after ${maxAttempts} failed attempts.`
            );
          }
        }
      }
    }
  }
}

export async function preprocess(
  wallet: any,
  mint: string,
  Wsol_bundling: number,
  Wsol_distribute: number
) {
  const wallets = await generateRandomWalletKeypair(10);
  const wallets1: Keypair[] = wallets.slice(0, 3); // First 3 wallets
  const wallets2: Keypair[] = wallets.slice(3);
  store.set(walletsForBundlingAtom, wallets1);
  store.set(walletsForRemainingAtom, wallets2);
  store.set(walletsForAllAtom, wallets);
  await distributeSOLForFee(wallet, wallets);
  await initializingATA(wallets, mint, wallet);
  await execute_wrapping_sol_bundling(wallet, wallets1, Wsol_bundling);
  await execute_randomly_wrapping_sol(wallet, wallets2, Wsol_distribute);
  console.log("done");
}
