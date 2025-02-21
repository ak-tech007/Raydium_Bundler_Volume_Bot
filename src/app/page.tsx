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
import dotenv from "dotenv";
import { PinataSDK } from "pinata-web3";
dotenv.config();
const pinata = new PinataSDK({
  pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT,
  pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY,
});
export default function Home() {
  const { data: session, status } = useSession();
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [transaction, setTransaction] = useState("");
  const [mint, setMint] = useState("");
  const [num, setNum] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [token_name, setTokenName] = useState("");
  const [token_symbol, setTokenSymbol] = useState("");
  const [token_description, setTokenDescription] = useState("");
  const [token_twitter, setTokenTwitter] = useState("");
  const [token_telegram, setTokenTelegram] = useState("");
  const [token_website, setTokenWebsite] = useState("");
  const [token_image, setTokenImage] = useState(""); // Stores the IPFS URL
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // Stores file before upload
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadToPinata = async () => {
    if (!selectedFile) {
      alert("Please select a file first!");
      return;
    }

    setUploading(true);

    try {
      // Convert file to Blob
      const fileBlob = new Blob([selectedFile], { type: selectedFile.type });
      const fileToUpload = new File([fileBlob], selectedFile.name, {
        type: selectedFile.type,
      });

      // Upload using PinataSDK
      const result = await pinata.upload.file(fileToUpload);

      if (result.IpfsHash) {
        const ipfsUrl = `https://ipfs.io/ipfs/${result.IpfsHash}`;
        setTokenImage(ipfsUrl); // Store uploaded IPFS URL
      } else {
        alert("Failed to upload image.");
      }
    } catch (error) {
      console.error("Error uploading to Pinata:", error);
      alert("Upload failed!");
    }

    setUploading(false);
  };
  const handleSignIn = async () => {
    try {
      const csrf = await getCsrfToken();
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
      toast.success("Signed in successfully!");
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
      const result = await createNewmint({
        wallet: wallet,
        amount: num * 1000000000,
        name: token_name,
        symbol: token_symbol,
        description: token_description,
        image: token_image,
        twitter: token_twitter,
        telegram: token_telegram,
        website: token_website,
      });
      if (result && result.sign) {
        setTransaction(result.sign);
        toast.success("Token minted successfully!");
      }
      if (result && result.tokenMintAccount) {
        setMint(result.tokenMintAccount);
      }
    }
  };
  useEffect(() => {
    setIsClient(true);
    if (!wallet.connected && session) {
      signOut();
    }
  }, [wallet.connected]);

  if (!isClient) return null;

  return (
    <>
      <div className="flex justify-end mt-6 mr-10 ">
        <CustomWalletButton />
      </div>

      {session ? (
        <>
          <div className="flex flex-col items-center space-y-6 p-6 bg-gradient-to-br from-white to-gray-100 shadow-xl rounded-3xl w-full max-w-lg mx-auto mt-10 border border-gray-200">
            {/* Success Message */}
            <p className="text-green-600 font-semibold text-lg">
              ✅ You are signed in successfully!
            </p>

            {/* Token Details Form */}
            <div className="w-full space-y-4">
              {/* Token Name */}
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Token Name
                </label>
                <input
                  type="text"
                  value={token_name}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
                  placeholder="Enter token name..."
                />
              </div>

              {/* Token Symbol */}
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Token Symbol
                </label>
                <input
                  type="text"
                  value={token_symbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
                  placeholder="Enter token symbol..."
                />
              </div>

              {/* Token Description */}
              <div>
                <label className="block text-gray-700 font-medium mb-1">
                  Token Description
                </label>
                <textarea
                  value={token_description}
                  onChange={(e) => setTokenDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
                  placeholder="Enter token description..."
                />
              </div>

              {/* Token Image URL */}
              <div className="w-full">
                {/* Label */}
                <label className="block text-gray-700 font-medium mb-1">
                  Token Image
                </label>

                {/* File Input */}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
                />

                {/* Upload Button */}
                <button
                  onClick={uploadToPinata}
                  className={`mt-2 w-full px-4 py-2 rounded-lg text-white font-semibold ${
                    uploading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload to Pinata"}
                </button>

                {/* Preview Image */}
                {token_image && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">Uploaded Image:</p>
                    <img
                      src={token_image}
                      alt="Uploaded Token"
                      className="mt-2 w-32 h-32 rounded-lg border border-gray-300 object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Social Links */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Twitter URL
                  </label>
                  <input
                    type="text"
                    value={token_twitter}
                    onChange={(e) => setTokenTwitter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
                    placeholder="Enter Twitter URL..."
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1">
                    Telegram URL
                  </label>
                  <input
                    type="text"
                    value={token_telegram}
                    onChange={(e) => setTokenTelegram(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
                    placeholder="Enter Telegram URL..."
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-gray-700 font-medium mb-1">
                    Website URL
                  </label>
                  <input
                    type="text"
                    value={token_website}
                    onChange={(e) => setTokenWebsite(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
                    placeholder="Enter Website URL..."
                  />
                </div>
              </div>
            </div>

            {/* Token Amount */}
            <div className="w-full">
              <label className="block text-gray-700 font-medium mb-2">
                Set Token Amount
              </label>
              <input
                type="number"
                value={num === 0 ? "" : num}
                onChange={(e) => setNum(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm transition-all"
              />
            </div>

            {/* Mint & Transaction Details */}
            <div className="w-full space-y-3">
              <div className="p-4 bg-white shadow-md rounded-xl border border-gray-200">
                <p className="text-sm font-semibold text-gray-800 flex items-center">
                  🔹 <span className="ml-1">Token Mint Address:</span>
                </p>
                <p className="mt-1 text-gray-600 text-sm font-medium break-all">
                  {mint}
                </p>
              </div>

              <div className="p-4 bg-white shadow-md rounded-xl border border-gray-200">
                <p className="text-sm font-semibold text-gray-800 flex items-center">
                  🔹 <span className="ml-1">Transaction ID:</span>
                </p>
                <a
                  href={`https://solscan.io/tx/${transaction}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-1 text-blue-600 hover:text-blue-800 text-sm font-medium break-all transition-all"
                >
                  {transaction}
                </a>
              </div>
            </div>

            {/* Create Mint Button */}
            <button
              onClick={() => createMint()}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-indigo-600 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105"
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
