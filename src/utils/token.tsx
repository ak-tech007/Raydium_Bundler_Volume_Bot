'use client'
import {
createInitializeMint2Instruction,
    createInitializeMintInstruction,
    getMinimumBalanceForRentExemptMint,
    MINT_SIZE,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
    clusterApiUrl,
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";

    
    
    
export const createNewmint = async (wallet: any) => {
    try {
        // Establish connection to Solana devnet
        const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
        const phantomPublicKey = wallet.publicKey;

        const programId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        const decimals = 6;
        const lamports = await getMinimumBalanceForRentExemptMint(connection);

        // Generate a new keypair for the mint account
        const mintAccount = Keypair.generate();

        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: phantomPublicKey,
                newAccountPubkey: mintAccount.publicKey,
                space: MINT_SIZE,
                lamports,
                programId,
            }),
            createInitializeMint2Instruction(mintAccount.publicKey, decimals, phantomPublicKey, phantomPublicKey, programId),
        );

        // Set the recent blockhash and fee payer
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = phantomPublicKey;

        // Request Phantom Wallet to sign and send the transaction
        if (wallet.signTransaction) {
        const signedTransaction = await wallet.signTransaction(transaction);

        // Log the signed transaction
        console.log("Signed transaction:", signedTransaction);
        signedTransaction.partialSign(mintAccount);

        // Send the signed transaction
        const rawTransaction = signedTransaction.serialize();
        const signature = await connection.sendRawTransaction(rawTransaction);

        // Log the transaction signature
        console.log("Transaction sent. Signature:", signature);

        // Confirm the transaction
        const confirmation = await connection.confirmTransaction(signature);
        console.log("Transaction confirmed:", confirmation);

        // Optionally, check the transaction status
        const transactionStatus = await connection.getTransaction(signature);
        console.log("Transaction status:", transactionStatus);
        } else {
            throw new Error("Wallet does not support signing transactions");
        }
    } catch (error: unknown) {
        console.error(
            "Transaction failed:",
            error
        );
    }
};