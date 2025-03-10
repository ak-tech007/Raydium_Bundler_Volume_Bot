import { Keypair, PublicKey } from "@solana/web3.js";
import { concentrateTokens, getTokenBalance } from "./distribute";
import { NATIVE_MINT } from "@solana/spl-token";
import { tradingStateAtom } from "../state/atoms";
import { getDefaultStore } from "jotai";
import { delay } from "./distribute";
import bs58 from "bs58";

const store = getDefaultStore();

export async function Sell(mint: string, allWallets: string[]) {
  const TOKEN_MINT = new PublicKey(mint);

  while (store.get(tradingStateAtom) === "selling") {
    let randomIndex = Math.floor(Math.random() * allWallets.length);
    let wallet_privateKey = allWallets[randomIndex];
    let wallet_keypair = Keypair.fromSecretKey(bs58.decode(wallet_privateKey));

    let balance = await getTokenBalance(wallet_keypair.publicKey, TOKEN_MINT);
    if (balance <= 0) {
      console.warn(
        `❌ Wallet ${wallet_keypair.publicKey.toBase58()} has no Token. Skipping...`
      );
      continue;
    }

    let swapAmount = Math.min(
      balance,
      Math.floor(balance * (0.1 + Math.random() * 0.4))
    );

    try {
      const response = await fetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletPrivateKey: wallet_privateKey,
          amount: swapAmount,
          mint: mint,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        console.log(
          `✅ Successfully swap ${swapAmount} tokens from ${wallet_keypair.publicKey.toBase58()}`
        );
      } else {
        console.warn(
          `❌ Swap failed for ${wallet_keypair.publicKey.toBase58()}:`,
          result.error || "Unknown error"
        );
      }
    } catch (error) {
      console.warn(
        `❌ Swap failed for ${wallet_keypair.publicKey.toBase58()}:`,
        error
      );
    }

    await delay(1000); // Small delay to avoid excessive looping
  }
}

export async function Buy(mint: string, allWallets: string[]) {
  const TOKEN_MINT = new PublicKey(mint);

  while (store.get(tradingStateAtom) === "buying") {
    let randomIndex = Math.floor(Math.random() * allWallets.length);
    let wallet_privateKey = allWallets[randomIndex];
    let wallet_keypair = Keypair.fromSecretKey(bs58.decode(wallet_privateKey));
    let balance = await getTokenBalance(wallet_keypair.publicKey, NATIVE_MINT);
    if (balance <= 0) {
      console.warn(
        `❌ Wallet ${wallet_keypair.publicKey.toBase58()} has no Token. Skipping...`
      );
      continue;
    }

    let swapAmount = Math.min(
      balance,
      Math.floor(balance * (0.1 + Math.random() * 0.4))
    );
    // await wrapSol_keypair(wallet, swapAmount);

    try {
      const response = await fetch("/api/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletPrivateKey: wallet_privateKey,
          amount: swapAmount,
          mint: mint,
        }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        console.log(
          `✅ Successfully swap ${swapAmount} WSOL from ${wallet_keypair.publicKey.toBase58()}`
        );
      } else {
        console.warn(
          `❌ Swap failed for ${wallet_keypair.publicKey.toBase58()}:`,
          result.error || "Unknown error"
        );
      }
    } catch (error) {
      console.warn(
        `❌ Swap failed for ${wallet_keypair.publicKey.toBase58()}:`,
        error
      );
    }

    await delay(1000); // Small delay to avoid excessive looping
  }
}

export async function Sell_Once(mint: string, allWallets: string[]) {
  const TOKEN_MINT = new PublicKey(mint);

  const target_wallet = await concentrateTokens(TOKEN_MINT, allWallets);

  let balance = await getTokenBalance(target_wallet.publicKey, TOKEN_MINT);
  if (balance <= 0) {
    console.warn(
      `❌ Wallet ${target_wallet.publicKey.toBase58()} has no Token. Skipping...`
    );
    return;
  }
  const wallet_secureKey = bs58.encode(target_wallet.secretKey);

  let swapAmount = balance;
  console.log(swapAmount);

  try {
    const response = await fetch("/api/sellonce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletPrivateKey: wallet_secureKey,
        amount: swapAmount,
        mint: mint,
      }),
    });

    const result = await response.json();
    if (response.ok && result.success) {
      console.log(
        `✅ Successfully swap ${swapAmount} tokens from ${target_wallet.publicKey.toBase58()}`
      );
    } else {
      console.warn(
        `❌ Swap failed for ${target_wallet.publicKey.toBase58()}:`,
        result.error || "Unknown error"
      );
    }
  } catch (error) {
    console.warn(
      `❌ Swap failed for ${target_wallet.publicKey.toBase58()}:`,
      error
    );
  }
}
