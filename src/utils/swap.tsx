import { Keypair, PublicKey } from "@solana/web3.js";
import { getTokenBalance } from "./distribute";
import { NATIVE_MINT } from "@solana/spl-token";

async function swapUntilPriceLimit(mint: string, allWallets: Keypair[]) {
  const TOKEN_MINT = new PublicKey(mint);
  while (true) {
    if (currentPrice >= targetPrice) {
      console.log(`🎯 Target price ${targetPrice} reached. Stopping swaps.`);
      break; // Stop if the price reaches the target
    }

    // Select a random wallet
    let randomIndex = Math.floor(Math.random() * allWallets.length);
    let wallet = allWallets[randomIndex];

    // Get WSOL balance of the wallet
    let balance = await getTokenBalance(wallet.publicKey, TOKEN_MINT);
    if (balance <= 0) {
      console.warn(
        `❌ Wallet ${wallet.publicKey.toBase58()} has no WSOL. Skipping...`
      );
      continue;
    }

    // Determine a random swap amount (10%-50% of balance)
    let swapAmount = Math.min(
      balance,
      Math.floor(balance * (0.1 + Math.random() * 0.4))
    );

    // Execute swap
    try {
      await performSwap(wallet, swapAmount);
      console.log(
        `✅ Swapped ${swapAmount} WSOL from ${wallet.publicKey.toBase58()}`
      );
    } catch (error) {
      console.warn(`❌ Swap failed for ${wallet.publicKey.toBase58()}:`, error);
    }
  }
}
