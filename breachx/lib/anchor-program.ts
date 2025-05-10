import * as anchor from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { WalletContextState } from "@solana/wallet-adapter-react";
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { Anchor } from "./contract/types/anchor";
import idl from "./contract/idl/anchor.json";

export const PROGRAM_ID = "CT2TbWY3ny6wn6jRq3RPdqh4gnmtupzNhdJHeWCkzaKw";

export type VulnerabilityReport = {
  repositoryId: string;
  reportUrl: string;
  reporter: PublicKey;
  timestamp: anchor.BN;
};

export type ReportWithTransaction = {
  pda: PublicKey;
  report: VulnerabilityReport;
  transactionId?: string;
};

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

export async function storeVulnerabilityReport(
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

  try {
    const tx = await program.methods
      .storeVulnerabilityReport(repositoryId, reportUrl)
      .accounts({
        // @ts-expect-error - Account property names from IDL
        vulnerabilityReport: vulnerabilityReportPda,
        reporter: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    return { tx, pda: vulnerabilityReportPda };
  } catch (error) {
    console.error("Error storing vulnerability report:", error);
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

    return { pda, report, transactionId };
  } catch (e) {
    console.error("Error getting repository report:", e);
    return null;
  }
}
