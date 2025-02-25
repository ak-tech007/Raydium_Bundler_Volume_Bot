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
import CustomWalletButton from "./_components/CustomWalletButton";
import toast from "react-hot-toast";
import dotenv from "dotenv";
import { PinataSDK } from "pinata-web3";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { Program, AnchorProvider, web3, BN } from "@project-serum/anchor";
import idl from "./_idl/initialize_pool.json";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccount,
} from "@solana/spl-token";
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
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );
  const provider = new AnchorProvider(
    connection,
    wallet as any,
    AnchorProvider.defaultOptions()
  );

  const programId = new PublicKey(
    "5nkUCxN2iFukZkE5yk2Z4HTxrPdwHZMmZskGzWcAfr1F"
  ); // Replace with your program ID
  const program = new Program(idl as any, programId, provider);

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
        wallet: wallet as any,
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

  async function initialize_new_pool() {
    try {
      // Define all the required accounts
      const programId = new PublicKey(
        "CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW"
      );
      const creator = wallet.publicKey;
      if (!creator) {
        throw new Error("Wallet public key is null");
      }

      const ammConfig = await connection.getProgramAccounts(programId, {
        filters: [
          {
            dataSize: 236, // Data size of AmmConfig struct
          },
        ],
      });
      if (ammConfig.length === 0) {
        throw new Error("No ammConfig account found.");
      }

      const ammConfigAccount = ammConfig[0]; // Get the first account
      const authority = await PublicKey.findProgramAddressSync(
        [Buffer.from("vault_and_lp_mint_auth_seed")],
        programId
      )[0];
      const token0Mint = await new PublicKey(
        "CG9FSBTMiFBtYyoJgeTrPuG7RAFPr8qGVHV79fK4XXZg"
      );
      const token1Mint = new PublicKey(
        "So11111111111111111111111111111111111111112"
      );
      const [poolState, bump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("pool", "utf-8"), // First seed
          ammConfigAccount.pubkey.toBuffer(), // Second seed
          token0Mint.toBuffer(), // Third seed
          token1Mint.toBuffer(), // Fourth seed
        ],
        programId // Program ID
      );

      console.log(poolState.toBase58());
      const [lpMint] = await PublicKey.findProgramAddressSync(
        [Buffer.from("POOL_LP_MINT_SEED"), poolState.toBuffer()],

        programId
      );
      const creatorToken0 = await getAssociatedTokenAddress(
        token0Mint,
        creator,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const creatorToken1 = await getAssociatedTokenAddress(
        token1Mint,
        creator,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const creatorLpToken = await getAssociatedTokenAddress(lpMint, creator);
      const [token0Vault] = await PublicKey.findProgramAddressSync(
        [
          Buffer.from("POOL_VAULT_SEED"),
          poolState.toBuffer(),
          token0Mint.toBuffer(),
        ],
        programId // Replace with the Raydium CP program ID
      );
      const [token1Vault] = await PublicKey.findProgramAddressSync(
        [
          Buffer.from("POOL_VAULT_SEED"),
          poolState.toBuffer(),
          token1Mint.toBuffer(),
        ],
        programId // Replace with the Raydium CP program ID
      );
      const createPoolFee = new PublicKey(
        "3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR"
      );
      const [observationState] = await PublicKey.findProgramAddressSync(
        [Buffer.from("OBSERVATION_SEED"), poolState.toBuffer()],
        programId // Replace with the Raydium CP program ID
      );
      const tokenProgram = TOKEN_2022_PROGRAM_ID;
      const token0Program = TOKEN_2022_PROGRAM_ID;
      const token1Program = TOKEN_PROGRAM_ID;
      const associatedTokenProgram = ASSOCIATED_TOKEN_PROGRAM_ID;
      const systemProgram = SystemProgram.programId;
      const rent = new PublicKey("SysvarRent111111111111111111111111111111111");

      // // Convert values to BN
      // const initialAmount0 = new BN(1000); // Replace with your actual value
      // const initialAmount1 = new BN(1000); // Replace with your actual value
      const open_time = new BN(Math.floor(Date.now() / 1000));

      const transaction = await program.methods
        .initializeNewPool(initial_amount0, initial_amount1, open_time)
        .accounts({
          cpSwapProgram: programId,
          creator: creator,
          ammConfig: ammConfigAccount.pubkey,
          authority: authority,
          token0Mint: token0Mint,
          token1Mint: token1Mint,
          poolState: poolState,
          lpMint: lpMint,
          creatorToken0: creatorToken0,
          creatorToken1: creatorToken1,
          creatorLpToken: creatorLpToken,
          token0Vault: token0Vault,
          token1Vault: token1Vault,
          createPoolFee: createPoolFee,
          observationState: observationState,
          tokenProgram: tokenProgram,
          token0Program: token0Program,
          token1Program: token1Program,
          associatedTokenProgram: associatedTokenProgram,
          systemProgram: systemProgram,
          rent: rent,
        })
        .rpc();
      await connection.confirmTransaction(transaction, "finalized");
      alert("Transaction successfully confirmed!");
    } catch (error) {
      console.error("Error initializing new pool:", error);
    }
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
                    Token Amount
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
              </div>
            </div>

            {/* Initialize Pool Section */}
            <div className="w-full bg-white/80 backdrop-blur-lg shadow-xl p-10 rounded-3xl border border-gray-300">
              <h2 className="text-4xl font-bold text-center bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
                Initialize New Pool
              </h2>
              <div className="space-y-6 mt-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Initial Amount 0
                  </label>
                  <input
                    type="number"
                    onChange={(e) => setInitialAmount0(new BN(e.target.value))}
                    value={initial_amount0 === 0 ? "" : initial_amount0}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Initial Amount 1
                  </label>
                  <input
                    type="number"
                    onChange={(e) => setInitialAmount1(new BN(e.target.value))}
                    value={initial_amount1 === 0 ? "" : initial_amount1}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none text-black"
                  />
                </div>

                <button
                  onClick={initialize_new_pool}
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold rounded-xl shadow-lg hover:shadow-2xl transition-all"
                >
                  🏊‍♂️ Initialize New Pool
                </button>
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
