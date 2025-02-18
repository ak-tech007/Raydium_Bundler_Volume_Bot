"use client";

import { useEffect } from "react";
import { WalletMultiButton, useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet} from "@solana/wallet-adapter-react";
import { useSession, signIn } from "next-auth/react";
import bs58 from "bs58";
import { getCsrfToken } from "next-auth/react";
import { SigninMessage } from "@/utils/SigninMessage";

export default function Home() {
  const { data: session, status } = useSession();
  const wallet = useWallet();
  const walletModal = useWalletModal();

  const handleSignIn = async () => {
    try {

      const csrf = await getCsrfToken();
      console.log("csrf", csrf);
      if (!wallet.publicKey || !csrf || !wallet.signMessage) return;

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
    } catch (error) {
      console.error("Sign-in error:", error);
    }
  };

  // Auto-authenticate when wallet connects
  useEffect(() => {
    if (wallet.connected && status === "unauthenticated") {
      handleSignIn();
    }
  }, [wallet.connected]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen space-y-4">
      <div className="border hover:border-slate-900 rounded p-4">
        <div onClick={handleSignIn}>kkk</div>
        <WalletMultiButton />
      </div>
      {session ? (
        <p className="text-green-600">✅ Signed in as {session.user?.name}</p>
      ) : (
        <p className="text-red-600">❌ Not signed in</p>
      )}
    </main>
  );
}
