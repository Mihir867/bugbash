import * as anchor from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { WalletContextState } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Anchor } from "./contract/types/anchor";
import idl from "./contract/idl/anchor.json";

export const PROGRAM_ID = "CT2TbWY3ny6wn6jRq3RPdqh4gnmtupzNhdJHeWCkzaKw";
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export type VulnerabilityReport = {
  repositoryId: string;
  reportUrl: string;
  reporter: PublicKey;
  timestamp: anchor.BN;
  nftMint: PublicKey;
};

export type ReportWithTransaction = {
  pda: PublicKey;
  report: VulnerabilityReport;
  transactionId?: string;
  nftMint?: PublicKey;
};

export interface CompactNFTMetadata {
  name: string;
  symbol: string;
  uri: string;
}

export function createAnchorWallet(
  wallet: WalletContextState
): AnchorWallet | undefined {
  if (
    !wallet.publicKey ||
    !wallet.signTransaction ||
    !wallet.signAllTransactions
  )
    return undefined;

  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction as <
      T extends Transaction | VersionedTransaction
    >(
      transaction: T
    ) => Promise<T>,
    signAllTransactions: wallet.signAllTransactions as <
      T extends Transaction | VersionedTransaction
    >(
      transactions: T[]
    ) => Promise<T[]>,
  };
}

export async function getProgram(
  wallet: AnchorWallet | undefined,
  connection: Connection
) {
  if (!wallet) {
    throw new Error("Wallet not connected");
  }

  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });

  try {
    anchor.setProvider(provider);
    const program: anchor.Program<Anchor> = new anchor.Program(
      idl as Anchor,
      provider
    );
    return program;
  } catch (error) {
    console.error("Error creating program:", error);
    throw error;
  }
}

export function generateCompactSecurityBadgeMetadata(
  repositoryId: string,
  reportUrl: string,
  timestamp: number
): CompactNFTMetadata {
  const repoName = repositoryId.split("/").pop() || repositoryId;

  return {
    name: `Security Badge - ${repoName}`,
    symbol: "BXSB",
    uri: "", // Will be set after Pinata upload
  };
}

// Upload full metadata to Pinata and return URI
export async function uploadMetadataToIPFS(
  repositoryId: string,
  reportUrl: string,
  timestamp: number
): Promise<string> {
  const repoName = repositoryId.split("/").pop() || repositoryId;

  const fullMetadata = {
    name: `BreachX Security Badge - ${repoName}`,
    symbol: "BXSB",
    description: `Security verification badge for ${repositoryId}. This NFT represents a verified security audit conducted on ${new Date(
      timestamp * 1000
    ).toLocaleDateString()}.`,
    image: "http://localhost:3000/api/nft-image/security-badge.png",
    attributes: [
      {
        trait_type: "Repository",
        value: repositoryId,
      },
      {
        trait_type: "Audit Date",
        value: new Date(timestamp * 1000).toLocaleDateString(),
      },
      {
        trait_type: "Badge Type",
        value: "Security Verification",
      },
      {
        trait_type: "Platform",
        value: "BreachX",
      },
    ],
    properties: {
      files: [
        {
          uri: "http://localhost:3000/api/nft-image/security-badge.png",
          type: "image/png",
        },
      ],
      category: "image",
    },
  };

  try {
    const response = await fetch("/api/upload-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fullMetadata),
    });

    if (!response.ok) {
      throw new Error("Failed to upload metadata");
    }

    const result = await response.json();
    return result.uri;
  } catch (error) {
    console.error("Error uploading metadata:", error);
    // Fallback to a base64 encoded URI for development
    return `data:application/json;base64,${btoa(JSON.stringify(fullMetadata))}`;
  }
}

export async function storeVulnerabilityReportAndMintNFT(
  program: anchor.Program<Anchor>,
  repositoryId: string,
  reportUrl: string
) {
  if (!program.provider.wallet) {
    throw new Error("Wallet not connected");
  }

  const wallet = program.provider.wallet;

  const [vulnerabilityReportPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("vulnerability_report"),
      wallet.publicKey.toBuffer(),
      Buffer.from(repositoryId),
    ],
    program.programId
  );

  const [mintPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("mint"),
      wallet.publicKey.toBuffer(),
      Buffer.from(repositoryId),
    ],
    program.programId
  );

  const tokenAccount = await getAssociatedTokenAddress(
    mintPda,
    wallet.publicKey
  );

  const timestamp = Math.floor(Date.now() / 1000);
  const metadataUri = await uploadMetadataToIPFS(
    repositoryId,
    reportUrl,
    timestamp
  );

  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mintPda.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  const compactMetadata = generateCompactSecurityBadgeMetadata(
    repositoryId,
    reportUrl,
    timestamp
  );
  compactMetadata.uri = metadataUri;

  try {
    const tx1 = await program.methods
      .storeVulnerabilityReport(repositoryId, reportUrl)
      .accounts({
        // @ts-expect-error - Account property names from IDL
        vulnerabilityReport: vulnerabilityReportPda,
        reporter: wallet.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const tx2 = await program.methods
      .mintSecurityBadgeNft(
        repositoryId,
        compactMetadata.name,
        compactMetadata.symbol,
        compactMetadata.uri
      )
      .accounts({
        // @ts-expect-error - Account property names from IDL
        vulnerabilityReport: vulnerabilityReportPda,
        mint: mintPda,
        tokenAccount: tokenAccount,
        metadata: metadataPda,
        reporter: wallet.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      })
      .rpc();

    return {
      tx1,
      tx2,
      pda: vulnerabilityReportPda,
      nftMint: mintPda,
      tokenAccount,
    };
  } catch (error) {
    console.error("Error storing vulnerability report and minting NFT:", error);
    throw error;
  }
}

export async function getVulnerabilityReport(
  program: anchor.Program<Anchor>,
  pda: PublicKey
): Promise<VulnerabilityReport | null> {
  try {
    return (await program.account.vulnerabilityReport.fetch(
      pda
    )) as VulnerabilityReport;
  } catch (e) {
    console.error("Error fetching vulnerability report:", e);
    return null;
  }
}

async function findTransactionSignature(
  connection: Connection,
  pda: PublicKey
): Promise<string | undefined> {
  try {
    const signatures = await connection.getSignaturesForAddress(pda, {
      limit: 1,
    });

    if (signatures && signatures.length > 0) {
      return signatures[0].signature;
    }

    return undefined;
  } catch (error) {
    console.error("Error finding transaction signature:", error);
    return undefined;
  }
}

export async function getUserVulnerabilityReports(
  program: anchor.Program<Anchor>,
  userPubkey: PublicKey
): Promise<Array<ReportWithTransaction>> {
  try {
    const reports = await program.account.vulnerabilityReport.all();
    const filteredReports = reports.filter(
      (item) => item.account.reporter.toBase58() === userPubkey.toBase58()
    );

    const connection = program.provider.connection;
    const reportsWithTransactions = await Promise.all(
      filteredReports.map(async (item) => {
        const transactionId = await findTransactionSignature(
          connection,
          item.publicKey
        );

        return {
          pda: item.publicKey,
          report: item.account as VulnerabilityReport,
          transactionId,
          nftMint: (item.account as VulnerabilityReport).nftMint,
        };
      })
    );

    return reportsWithTransactions;
  } catch (e) {
    console.error("Error getting user vulnerability reports:", e);
    return [];
  }
}

export async function getReportByRepositoryId(
  program: anchor.Program<Anchor>,
  userPubkey: PublicKey,
  repositoryId: string
): Promise<ReportWithTransaction | null> {
  try {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vulnerability_report"),
        userPubkey.toBuffer(),
        Buffer.from(repositoryId),
      ],
      program.programId
    );

    const report = await getVulnerabilityReport(program, pda);
    if (!report) return null;

    const connection = program.provider.connection;
    const transactionId = await findTransactionSignature(connection, pda);

    return {
      pda,
      report,
      transactionId,
      nftMint: report.nftMint,
    };
  } catch (e) {
    console.error("Error getting repository report:", e);
    return null;
  }
}

export async function getNFTMetadata(
  connection: Connection,
  mintAddress: PublicKey
): Promise<any> {
  try {
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintAddress.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(metadataPda);
    if (!accountInfo) return null;

    return { metadataPda, accountInfo };
  } catch (error) {
    console.error("Error fetching NFT metadata:", error);
    return null;
  }
}
