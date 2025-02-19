"use client";

import { useState, useEffect } from "react";
import { WalletMultiButton, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet} from "@solana/wallet-adapter-react";
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
  const [transaction, setTransaction] = useState("")
  const [mint, setMint] = useState("");

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
      const result = await createNewmint(wallet);
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
  }, [wallet.connected,]);

  return (<>
    <div className="flex justify-end mt-6 mr-10 ">
        <CustomWalletButton />
    </div>
      
      {session ? (<>
        <p className="text-green-600">You are signed successfully!</p>
        <button onClick={() => createMint()}>createMint</button>
        <p>Token Mint Address: {mint}</p>
        <p>Transaction ID: {transaction}</p>
        </>
      ) : (<div className="flex flex-col justify-center items-center mt-10 space-y-6">
        <p className="text-red-600 font-bold text-2xl animate-pulse">Please sign in first!</p>
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
