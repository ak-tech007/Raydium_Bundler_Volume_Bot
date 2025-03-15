import { Connection, PublicKey } from "@solana/web3.js";
import { Market } from "@project-serum/serum";
import * as dotenv from "dotenv";
dotenv.config();

export async function get_market_keys(market_key: string) {
  const OPENBOOK_PROGRAM_ID = new PublicKey(
    "EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"
  ); // Replace with OpenBook program ID
  const MARKET_KEY = new PublicKey(market_key);
  const connection = new Connection(
    process.env.NEXT_PUBLIC_RPC_URL || "",
    "confirmed"
  );

  const market = await Market.load(
    connection,
    MARKET_KEY,
    {}, // Options
    OPENBOOK_PROGRAM_ID
  );
  const MARKET_BIDS_KEY = await market.bidsAddress;
  const MARKET_ASKS_KEY = await market.asksAddress;
  const MARKET_EVENT_QUEUE_KEY = await market.decoded.eventQueue;
  const MARKET_COIN_VAULT_KEY = await market.decoded.baseVault;
  const MARKET_PC_VAULT_KEY = await market.decoded.quoteVault;
  const vaultSigner = await PublicKey.createProgramAddress(
    [
      MARKET_KEY.toBuffer(),
      market.decoded.vaultSignerNonce.toArrayLike(Buffer, "le", 8),
    ],
    OPENBOOK_PROGRAM_ID
  );

  return {
    MARKET_BIDS_KEY: MARKET_BIDS_KEY.toBase58(),
    MARKET_ASKS_KEY: MARKET_ASKS_KEY.toBase58(),
    MARKET_EVENT_QUEUE_KEY: MARKET_EVENT_QUEUE_KEY.toBase58(),
    MARKET_COIN_VAULT_KEY: MARKET_COIN_VAULT_KEY.toBase58(),
    MARKET_PC_VAULT_KEY: MARKET_PC_VAULT_KEY.toBase58(),
    MARKET_VAULT_SIGNER_KEY: vaultSigner.toBase58(),
  };
}
