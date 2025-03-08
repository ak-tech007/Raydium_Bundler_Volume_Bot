import { Keypair, PublicKey } from "@solana/web3.js";
import { atom } from "jotai";

// Represents the current trading state: "idle", "selling", or "buying"
export const tradingStateAtom = atom<"idle" | "selling" | "buying">("idle");
export const walletsForBundlingAtom = atom<Keypair[]>([]);
export const walletsForAllAtom = atom<Keypair[]>([]);
export const walletsForRemainingAtom = atom<Keypair[]>([]);
export const vaultsAtom = atom<{ token0Vault: PublicKey | null; token1Vault: PublicKey | null }>({
    token0Vault: null,
    token1Vault: null,
  });
