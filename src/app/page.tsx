"use client";

import { useState, useEffect, use } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSession, signIn, signOut } from "next-auth/react";
import bs58 from "bs58";
import { getCsrfToken } from "next-auth/react";
import { SigninMessage } from "@/utils/SigninMessage";
import { createNewmint, wrapSol } from "@/utils/token";
import CustomWalletButton from "./_components/CustomWalletButton";
import toast from "react-hot-toast";
import dotenv from "dotenv";
import { PinataSDK } from "pinata-web3";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { initializeAndSwap } from "@/utils/pool";
dotenv.config();
const pinata = new PinataSDK({
  pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT,
  pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY,
});
export default function Home() {
  const { data: session, status } = useSession();
  const wallet = useWallet();
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
  const [initial_amount0, setInitialAmount0] = useState(0);
  const [initial_amount1, setInitialAmount1] = useState(0);
  const [wsol_amount, setWsolAmount] = useState(0);
  const [w_amount, setWAmount] = useState(0);
  const [amount_out1, setAmountOut1] = useState(0);
  const [amount_out2, setAmountOut2] = useState(0);
  const [amount_out3, setAmountOut3] = useState(0);
  const [jito_fee, setJitoFee] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialize_swap_pool, setInitializeSwapPool] = useState<string | null>(
    null
  );
  const [mint_address, setMintAddress] = useState("");

  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

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
  const wrap_sol = async () => {
    if (wallet.publicKey) {
      await wrapSol(wallet, w_amount);
    }
  };
  async function getWSOLBalance() {
    if (wallet.publicKey) {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        wallet.publicKey,
        { mint: NATIVE_MINT }
      );

      if (tokenAccounts.value.length > 0) {
        const balance =
          tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        setWsolAmount(balance);
      } else {
        console.log("No WSOL account found.");
        return 0;
      }
    }
  }
  const createMint = async () => {
    // Your minting logic here
    if (wallet.publicKey) {
      const result = await createNewmint({
        wallet: wallet as any,
        amount: num,
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
    getWSOLBalance();
  }, [wallet.connected]);

  async function initialize_and_swap() {
    setLoading(true); // Show loading state
    if (wallet.publicKey && mint_address) {
      const tx = await initializeAndSwap({
        wallet,
        mint: mint_address,
        initialAmount0: initial_amount0,
        initialAmount1: initial_amount1,
        amount_out1: amount_out1,
        amount_out2: amount_out2,
        amount_out3: amount_out3,
        jito_fee: jito_fee,
      });
      setInitializeSwapPool(tx);
    }
    setLoading(false); // Hide loading state
  }

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="flex justify-end p-6">
        <CustomWalletButton />
      </div>

      {session ? (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 to-white p-10">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Token Creation Form */}
            <div className="w-full bg-white/80 backdrop-blur-lg shadow-xl p-10 rounded-3xl border border-gray-300">
              <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Create Your Token
              </h1>
              <div className="space-y-6 mt-8">
                {/* Token Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Token Name
                  </label>
                  <input
                    type="text"
                    value={token_name}
                    onChange={(e) => setTokenName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-black"
                    placeholder="Enter token name..."
                  />
                </div>

                {/* Token Symbol */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Token Symbol
                  </label>
                  <input
                    type="text"
                    value={token_symbol}
                    onChange={(e) => setTokenSymbol(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-black"
                    placeholder="Enter token symbol..."
                  />
                </div>

                {/* Token Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Token Description
                  </label>
                  <textarea
                    value={token_description}
                    onChange={(e) => setTokenDescription(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-black"
                    placeholder="Enter token description..."
                  ></textarea>
                </div>

                {/* Token Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Token Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-black"
                  />
                  <button
                    onClick={uploadToPinata}
                    className={`mt-2 w-full px-4 py-3 rounded-xl font-semibold ${
                      uploading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    } transition-all`}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Upload to Pinata"}
                  </button>
                  {token_image && (
                    <div className="mt-4">
                      <img
                        src={token_image}
                        alt="Uploaded Token"
                        className="w-32 h-32 rounded-xl border-2 border-gray-600 object-cover hover:border-blue-500 transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Social Links */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Twitter URL
                    </label>
                    <input
                      type="text"
                      value={token_twitter}
                      onChange={(e) => setTokenTwitter(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-black"
                      placeholder="Enter Twitter URL..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Telegram URL
                    </label>
                    <input
                      type="text"
                      value={token_telegram}
                      onChange={(e) => setTokenTelegram(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-black"
                      placeholder="Enter Telegram URL..."
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Website URL
                    </label>
                    <input
                      type="text"
                      value={token_website}
                      onChange={(e) => setTokenWebsite(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-black"
                      placeholder="Enter Website URL..."
                    />
                  </div>
                </div>

                {/* Token Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Token Amount (token)
                  </label>
                  <input
                    type="number"
                    value={num === 0 ? "" : num}
                    onChange={(e) => setNum(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-black"
                  />
                </div>

                {/* Mint Address & Transaction */}
                <div className="space-y-4">
                  <div className="p-4 bg-gray-100 rounded-xl">
                    <p className="text-sm font-semibold text-gray-700">
                      Token Mint Address
                    </p>
                    <p className="mt-1 text-gray-500 break-all">{mint}</p>
                  </div>
                  <div className="p-4 bg-gray-100 rounded-xl">
                    <p className="text-sm font-semibold text-gray-700">
                      Transaction ID
                    </p>
                    <a
                      href={`https://solscan.io/tx/${transaction}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 text-blue-600 hover:text-blue-500 break-all transition-all"
                    >
                      {transaction}
                    </a>
                  </div>
                </div>

                {/* Create Mint Button */}
                <button
                  onClick={createMint}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl shadow-lg hover:shadow-2xl transition-all"
                >
                  🚀 Create Mint
                </button>
                <div className="flex flex-col items-center space-y-4">
                  {/* Display WSOL Balance */}
                  <div className="text-lg font-medium text-gray-800">
                    WSOL Balance:{" "}
                    <span className="font-bold text-green-600">
                      {wsol_amount}
                    </span>{" "}
                    WSOL
                  </div>

                  {/* Input Field for SOL Amount */}
                  <input
                    type="number"
                    placeholder="Enter SOL amount"
                    value={w_amount === 0 ? "" : w_amount}
                    onChange={(e) => setWAmount(Number(e.target.value))}
                    className="w-full max-w-sm px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none text-black"
                  />

                  {/* Wrap SOL Button */}
                  <button
                    className={`w-full max-w-sm px-6 py-3 font-bold rounded-xl shadow-lg transition-all 
      ${
        w_amount > 0
          ? "bg-gradient-to-r from-green-500 to-teal-500 text-white hover:shadow-2xl"
          : "bg-gray-400 text-gray-700 cursor-not-allowed"
      }`}
                    onClick={wrap_sol}
                    disabled={w_amount <= 0}
                  >
                    🪙 Wrap {w_amount || ""} SOL
                  </button>
                </div>
              </div>
            </div>

            {/* Initialize Pool Section */}
            <div className="w-full bg-white/80 backdrop-blur-lg shadow-xl p-10 rounded-3xl border border-gray-300">
              <h2 className="text-4xl font-bold text-center bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
                Initialize New Pool And Swap Tokens
              </h2>
              <div className="space-y-6 mt-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Token Mint Address
                  </label>
                  <input
                    type="text"
                    value={mint_address}
                    onChange={(e) => setMintAddress(e.target.value)}
                    placeholder="Enter token address..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Wrapped Sol (lamport)
                  </label>
                  <input
                    type="number"
                    onChange={(e) =>
                      setInitialAmount0(new anchor.BN(e.target.value))
                    }
                    value={initial_amount0 === 0 ? "" : initial_amount0}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Your Token (lamport)
                  </label>
                  <input
                    type="number"
                    onChange={(e) =>
                      setInitialAmount1(new anchor.BN(e.target.value))
                    }
                    value={initial_amount1 === 0 ? "" : initial_amount1}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Token amount to buy in Wallet1 (lamport)
                  </label>
                  <input
                    type="number"
                    onChange={(e) =>
                      setAmountOut1(new anchor.BN(e.target.value))
                    }
                    value={amount_out1 === 0 ? "" : amount_out1}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Token amount to buy in Wallet2 (lamport)
                  </label>
                  <input
                    type="number"
                    onChange={(e) =>
                      setAmountOut2(new anchor.BN(e.target.value))
                    }
                    value={amount_out2 === 0 ? "" : amount_out2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Token amount to buy in Wallet3 (lamport)
                  </label>
                  <input
                    type="number"
                    onChange={(e) =>
                      setAmountOut3(new anchor.BN(e.target.value))
                    }
                    value={amount_out3 === 0 ? "" : amount_out3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none text-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Bundling Fee sent to Jito Service (Sol : lamport)
                  </label>
                  <input
                    type="number"
                    onChange={(e) => setJitoFee(new anchor.BN(e.target.value))}
                    value={jito_fee === 0 ? "" : jito_fee}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none text-black"
                  />
                </div>
                <div className="p-4 bg-white rounded-xl shadow-lg">
                  {loading && (
                    <div className="p-4 text-center text-gray-700">
                      <p>⏳ Bundling transaction...</p>
                    </div>
                  )}

                  {!loading &&
                    initialize_swap_pool &&
                    initialize_swap_pool !== "Failed" && (
                      <div className="p-4 bg-gray-100 rounded-xl">
                        <p className="text-sm font-semibold text-gray-700">
                          Transaction ID
                        </p>
                        <a
                          href={`https://solscan.io/tx/${initialize_swap_pool}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 text-blue-600 hover:text-blue-500 break-all transition-all block overflow-x-auto whitespace-pre-wrap"
                        >
                          {initialize_swap_pool}
                        </a>
                      </div>
                    )}

                  {!loading && initialize_swap_pool === "Failed" && (
                    <div className="p-4 bg-red-100 rounded-xl text-center">
                      <p className="text-sm font-semibold text-red-700">
                        ❌ Plz retry bundling transaction
                      </p>
                    </div>
                  )}

                  <button
                    onClick={initialize_and_swap}
                    className={`w-full px-6 py-3 text-white font-bold rounded-xl shadow-lg transition-all mt-5 ${
                      loading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-green-500 to-teal-500 hover:shadow-2xl"
                    }`}
                    // disabled={loading} // Disable button while loading
                  >
                    {loading
                      ? "⏳ Processing..."
                      : "🏊‍♂️ Initialize New Pool And Swap"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center h-[80vh] bg-gradient-to-br from-white to-gray-100 p-12 rounded-xl shadow-lg border border-gray-300">
          <p className="text-4xl font-bold text-red-600 mb-8">
            Please Sign In First!
          </p>
          <button
            onClick={handleSignIn}
            className="px-6 py-3 text-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-600 transition-all"
          >
            SIGN IN
          </button>
        </div>
      )}
    </div>
  );
}
