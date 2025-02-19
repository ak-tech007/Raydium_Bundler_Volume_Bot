"use client";

import { useState, useEffect } from "react";
import {
  WalletMultiButton,
  useWalletModal,
} from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSession, signIn, signOut } from "next-auth/react";
import bs58 from "bs58";
import { getCsrfToken } from "next-auth/react";
import { SigninMessage } from "@/utils/SigninMessage";
import { createNewmint } from "@/utils/token";
import CustomWalletButton from "./components/CustomWalletButton";
import toast from "react-hot-toast";

export default function Home() {
  const { data: session, status } = useSession();
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [transaction, setTransaction] = useState("");
  const [mint, setMint] = useState("");
  const [num, setNum] = useState(0);

  const handleSignIn = async () => {
    try {
      const csrf = await getCsrfToken();
      console.log("csrf", csrf);
      if (!wallet.publicKey || !csrf || !wallet.signMessage) {
        toast.error("Wallet not connected.");
        return;
      }

      const message = new SigninMessage({
        domain: window.location.host,
        publicKey: wallet.publicKey?.toBase58(),
        statement: `Sign this message to sign in to the app.`,
        nonce: csrf,
      });
      const data = new TextEncoder().encode(message.prepare());
      const signature = await wallet.signMessage(data);
      const serializedSignature = bs58.encode(signature);

      signIn("credentials", {
        message: JSON.stringify(message),
        redirect: false,
        signature: serializedSignature,
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An unknown error occurred");
      }
    }
  };
  const createMint = async () => {
    // Your minting logic here
    if (wallet.publicKey) {
      const result = await createNewmint(wallet, num * 1000000);
      if (result && result.sign) {
        setTransaction(result.sign);
      }
      if (result && result.tokenMintAccount) {
        setMint(result.tokenMintAccount);
      }
    }
  };
  useEffect(() => {
    if (!wallet.connected && session) {
      signOut();
    }
  }, [wallet.connected]);

  return (
    <>
      <div className="flex justify-end mt-6 mr-10 ">
        <CustomWalletButton />
      </div>

      {session ? (
        <>
          <div className="flex flex-col items-center space-y-6 p-6 bg-white shadow-lg rounded-2xl w-full max-w-md mx-auto mt-10">
            {/* Success Message */}
            <p className="text-green-600 font-semibold text-lg">
              ✅ You are signed in successfully!
            </p>

            {/* Token Input Section */}
            <div className="w-full">
              <label className="block text-gray-700 font-medium mb-2">
                Set Token Amount
              </label>
              <input
                type="number"
                value={num === 0 ? "" : num}
                onChange={(e) => setNum(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Mint & Transaction Details */}

            <div className="max-w-full p-4 bg-white shadow-md rounded-lg border border-gray-200 overflow-auto">
              <p className="text-sm font-semibold text-gray-800 flex items-center">
                🔹 <span className="ml-1">Token Mint Address:</span>
              </p>
              <p className="mt-1 text-gray-600 text-sm font-medium break-all">
                {mint}
              </p>
            </div>

            <div className="max-w-full p-4 bg-white shadow-md rounded-lg border border-gray-200 overflow-auto mt-3">
              <p className="text-sm font-semibold text-gray-800 flex items-center">
                🔹 <span className="ml-1">Transaction ID:</span>
              </p>
              <a
                href={`https://solscan.io/tx/${transaction}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1 text-blue-600 hover:text-blue-800 text-sm font-medium break-all"
              >
                {transaction}
              </a>
            </div>

            {/* Create Mint Button */}
            <button
              onClick={() => createMint()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 ease-in-out"
            >
              🚀 Create Mint
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col justify-center items-center mt-10 space-y-6">
          <p className="text-red-600 font-bold text-2xl animate-pulse">
            Please sign in first!
          </p>
          <button
            className="py-3 px-5 bg-gradient-to-r from-blue-700 to-blue-500 rounded-lg text-white font-bold text-lg shadow-lg transition-transform transform hover:scale-105 hover:shadow-xl active:scale-95"
            onClick={handleSignIn}
          >
            SIGN IN
          </button>
        </div>
      )}
    </>
  );
}
