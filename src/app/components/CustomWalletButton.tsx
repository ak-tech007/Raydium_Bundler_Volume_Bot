"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useState } from "react";

export default function CustomWalletButton() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const balanceLamports = await connection.getBalance(new PublicKey(publicKey));
        setBalance(balanceLamports / 1e9); // Convert from lamports to SOL
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };

    fetchBalance();
  }, [publicKey, connection]);

  return (
    <div className="flex items-center space-x-4 border border-gray-300 px-4 py-2 rounded-lg">
      <WalletMultiButton />
      {publicKey && balance !== null && (
        <span className="text-lg font-medium text-gray-800">
          {balance.toFixed(2)} SOL
        </span>
      )}
    </div>
  );
}
