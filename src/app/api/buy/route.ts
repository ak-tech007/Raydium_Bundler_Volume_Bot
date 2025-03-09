import { NextRequest, NextResponse } from "next/server";
import { Keypair, Connection, PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { sellCustomTokens } from "@/lib/sellTokens"; // Move function to /lib
import bs58 from "bs58";
import { buyCustomTokens } from "@/lib/buyTokens";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log(body)
    
    // Validate request data
    if (!body.walletPrivateKey || !body.amount || !body.mint) {
      return NextResponse.json(
        { error: "walletPrivateKey, amount, and mint are required" },
        { status: 400 }
      );
    }

    // Decode private key
    const wallet = Keypair.fromSecretKey(
      bs58.decode(body.walletPrivateKey)
    );
    const amount = new anchor.BN(body.amount);
    const mint = body.mint;

    // Execute the sell function
    const txSignature = await buyCustomTokens(wallet, amount, mint);

    return NextResponse.json({ success: true, txSignature });
  } catch (error) {
    console.error("Sell token error:", error);
    return NextResponse.json(
      { error: "Failed to sell tokens", details: (error as Error).message },
      { status: 500 }
    );
  }
}