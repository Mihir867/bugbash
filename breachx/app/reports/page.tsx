"use client";

import { useEffect, useState } from "react";
import {
  useConnection,
  useWallet,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import {
  getProgram,
  storeVulnerabilityReportAndMintNFT,
  getUserVulnerabilityReports,
  ReportWithTransaction,
} from "@/lib/anchor-program";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Check,
  Award,
  Sparkles,
} from "lucide-react";
import { formatDate, getSolanaExplorerUrl, truncateAddress } from "@/lib/utils";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

export default function DemoPage() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [loading, setLoading] = useState(false);
  const [programError, setProgramError] = useState<string | null>(null);
  const [storingReport, setStoringReport] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [userReports, setUserReports] = useState<ReportWithTransaction[]>([]);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [mintedNFT, setMintedNFT] = useState<string | null>(null);

  const [repositoryId, setRepositoryId] = useState<string>("");
  const [reportUrl, setReportUrl] = useState<string>("");

  useEffect(() => {
    async function loadUserReports() {
      if (!publicKey || !connected) {
        setUserReports([]);
        setProgramError(null);
        return;
      }

      setLoading(true);
      setProgramError(null);

      try {
        const program = await getProgram(wallet, connection);

        if (!program) {
          setProgramError("Failed to initialize Anchor program");
          return;
        }

        const reports = await getUserVulnerabilityReports(program, publicKey);
        setUserReports(reports);
      } catch (error) {
        console.error("Error loading user reports:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        setProgramError(`Failed to load reports: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }

    loadUserReports();
  }, [publicKey, wallet, connection, txSignature, connected]);

  const handleStoreReportAndMintNFT = async () => {
    if (!publicKey || !connected) {
      alert("Please connect your wallet first");
      return;
    }

    if (!repositoryId.trim()) {
      alert("Repository ID is required");
      return;
    }

    if (!reportUrl.trim()) {
      alert("Report URL is required");
      return;
    }

    setStoringReport(true);
    setProgramError(null);
    setMintedNFT(null);

    try {
      const program = await getProgram(wallet, connection);

      if (!program) {
        throw new Error("Failed to initialize Anchor program");
      }

      const result = await storeVulnerabilityReportAndMintNFT(
        program,
        repositoryId,
        reportUrl
      );

      setTxSignature(result.tx1);
      setMintedNFT(result.nftMint.toString());

      setRepositoryId("");
      setReportUrl("");

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const reports = await getUserVulnerabilityReports(program, publicKey);
      setUserReports(reports);

      alert("Report stored and Security Badge NFT minted successfully!");
    } catch (error) {
      console.error("Error storing report and minting NFT:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setProgramError(`Failed to store report and mint NFT: ${errorMessage}`);
      alert("Failed to store report and mint NFT. Please try again.");
    } finally {
      setStoringReport(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedTxId(text);
        setCopySuccess(`${type} copied!`);

        setTimeout(() => {
          setCopySuccess(null);
          setCopiedTxId(null);
        }, 2000);
      },
      () => {
        setCopySuccess("Failed to copy");
        setTimeout(() => setCopySuccess(null), 2000);
      }
    );
  };

  return (
    <div className="min-h-screen py-24 bg-gradient-to-br from-gray-900 via-purple-900/20 to-blue-900/20">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex flex-col items-center justify-center mb-12">
          <div className="relative mb-6">
            <ShieldAlert className="h-16 w-16 text-purple-500" />
            <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-yellow-400 animate-pulse" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
            Zero-Day Vulnerability Reports
          </h1>
          <p className="mt-4 text-gray-400 text-center max-w-2xl">
            Store your vulnerability reports securely on the Solana blockchain
            and earn exclusive Security Badge NFTs. Each report is tied to a
            specific repository ID with verifiable proof of security audits.
          </p>

          {mintedNFT && (
            <div className="mt-6 p-4 bg-gradient-to-r from-green-900/40 to-blue-900/40 border border-green-500/50 rounded-lg">
              <div className="flex items-center justify-center space-x-2">
                <Award className="h-5 w-5 text-yellow-400" />
                <span className="text-green-400 font-medium">
                  Security Badge NFT Minted!
                </span>
                <button
                  onClick={() => copyToClipboard(mintedNFT, "NFT Mint Address")}
                  className="text-green-300 hover:text-white transition-colors"
                >
                  {copiedTxId === mintedNFT ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-center text-sm text-gray-300 mt-1 font-mono">
                {truncateAddress(mintedNFT)}
              </p>
            </div>
          )}
        </div>

        {programError && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-800 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
              <div>
                <h3 className="text-red-400 font-medium">Error</h3>
                <p className="text-red-300 text-sm">{programError}</p>
              </div>
            </div>
          </div>
        )}

        {copySuccess && (
          <div className="fixed bottom-4 right-4 bg-green-900/90 text-green-100 px-4 py-2 rounded-md shadow-lg animate-fade-in-out z-50">
            {copySuccess}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-gray-900/60 border border-gray-800 shadow-xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center">
                <Award className="mr-2 h-6 w-6 text-purple-400" />
                Store Report & Mint NFT
              </CardTitle>
              <CardDescription>
                Add a new vulnerability report to the Solana blockchain and
                receive a Security Badge NFT
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!connected ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
                  <p className="text-center text-gray-400 mb-4">
                    Please connect your wallet to store a vulnerability report
                    and mint your Security Badge NFT
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white" htmlFor="repositoryId">
                      Repository ID
                    </Label>
                    <Input
                      id="repositoryId"
                      placeholder="e.g., 98765432"
                      value={repositoryId}
                      onChange={(e) => setRepositoryId(e.target.value)}
                      className="bg-gray-950/50 border-gray-800 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white" htmlFor="reportUrl">
                      Report URL
                    </Label>
                    <Input
                      id="reportUrl"
                      placeholder="https://example.com/vulnerability-report"
                      value={reportUrl}
                      onChange={(e) => setReportUrl(e.target.value)}
                      className="bg-gray-950/50 border-gray-800 text-white"
                    />
                  </div>

                  <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-4 border border-purple-500/30">
                    <div className="flex items-start space-x-2">
                      <Sparkles className="h-5 w-5 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-purple-200 font-medium">
                          NFT Reward System
                        </p>
                        <p className="text-xs text-purple-300 mt-1">
                          Each security report earns you a unique Security Badge
                          NFT that proves your contribution to open-source
                          security.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-950/60 rounded-lg p-4 border border-gray-800/60">
                    <p className="text-sm text-gray-400">
                      <span className="text-yellow-500">Note:</span> Each
                      repository ID must be unique. If you submit a report with
                      an existing repository ID, it will overwrite the previous
                      report and mint a new NFT.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleStoreReportAndMintNFT}
                disabled={!connected || storingReport}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-md transition-all duration-200 transform hover:scale-105"
              >
                {storingReport ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Storing & Minting NFT...
                  </>
                ) : (
                  <>
                    <Award className="mr-2 h-4 w-4" />
                    Store Report & Mint NFT
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-gray-900/60 border border-gray-800 shadow-xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center">
                <ShieldAlert className="mr-2 h-6 w-6 text-green-400" />
                Your Security Reports
              </CardTitle>
              <CardDescription>
                View your stored vulnerability reports and Security Badge NFTs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : !connected ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
                  <p className="text-center text-gray-400">
                    Connect your wallet to view your reports and NFTs
                  </p>
                </div>
              ) : userReports.length > 0 ? (
                <div className="space-y-4">
                  {userReports.map((reportItem, index) => (
                    <div
                      key={index}
                      className="bg-gray-950/70 rounded-lg p-4 border border-gray-800/60 hover:border-purple-500/30 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs text-gray-500">
                          Repository ID
                        </span>
                        <div className="flex items-center space-x-2">
                          <div className="px-2 py-1 bg-purple-900/40 rounded-full text-purple-400 text-xs">
                            Verified on Solana
                          </div>
                          {reportItem.nftMint && (
                            <div className="px-2 py-1 bg-gradient-to-r from-yellow-900/40 to-orange-900/40 rounded-full text-yellow-400 text-xs flex items-center">
                              <Award className="h-3 w-3 mr-1" />
                              NFT Badge
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-lg font-medium text-white mb-2">
                        {reportItem.report.repositoryId}
                      </div>

                      <a
                        href={reportItem.report.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-medium text-blue-400 hover:underline flex items-center mb-3"
                      >
                        {reportItem.report.reportUrl}
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>

                      {reportItem.nftMint && (
                        <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-lg p-3 border border-yellow-500/30 mb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Award className="h-4 w-4 text-yellow-400" />
                              <span className="text-sm font-medium text-yellow-200">
                                Security Badge NFT
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  reportItem.nftMint!.toString(),
                                  "NFT Mint Address"
                                )
                              }
                              className="text-yellow-300 hover:text-white transition-colors"
                              title="Copy NFT Mint Address"
                            >
                              {copiedTxId === reportItem.nftMint!.toString() ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-yellow-300 font-mono mt-1">
                            {truncateAddress(reportItem.nftMint!.toString())}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Submitted by:</span>
                          <span className="text-gray-300 font-mono">
                            {truncateAddress(
                              reportItem.report.reporter.toString()
                            )}
                          </span>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Timestamp:</span>
                          <span className="text-gray-300">
                            {formatDate(
                              new Date(
                                reportItem.report.timestamp.toNumber() * 1000
                              )
                            )}
                          </span>
                        </div>

                        {reportItem.transactionId && (
                          <div className="flex justify-between text-sm items-center">
                            <span className="text-gray-400">
                              Transaction ID:
                            </span>
                            <div className="flex items-center">
                              <Link
                                href={getSolanaExplorerUrl(
                                  reportItem.transactionId
                                )}
                                target="_blank"
                                className="text-blue-400 hover:text-blue-300 font-mono text-xs truncate max-w-32 sm:max-w-48 md:max-w-32 lg:max-w-48"
                              >
                                {truncateAddress(reportItem.transactionId)}
                                <ExternalLink className="inline ml-1 h-3 w-3" />
                              </Link>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    reportItem.transactionId!,
                                    "Transaction ID"
                                  )
                                }
                                className="ml-2 text-gray-400 hover:text-white transition-colors"
                                title="Copy Transaction ID"
                              >
                                {copiedTxId === reportItem.transactionId ? (
                                  <Check className="h-3 w-3 text-green-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                  <div className="relative">
                    <Image
                      src="/placeholder-report.svg"
                      alt="No reports found"
                      width={120}
                      height={120}
                      className="opacity-50"
                    />
                    <Award className="absolute -top-2 -right-2 h-8 w-8 text-purple-400 opacity-60" />
                  </div>
                  <p className="text-center text-gray-400">
                    No vulnerability reports found for this wallet.
                  </p>
                  <p className="text-center text-sm text-gray-500">
                    Submit your first security report to earn a Security Badge
                    NFT!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {txSignature && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
              <Sparkles className="mr-2 h-6 w-6 text-yellow-400" />
              Recent Transaction
            </h2>
            <Card className="bg-gray-900/60 border border-gray-800 shadow-xl overflow-hidden backdrop-blur-sm">
              <div className="p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm font-medium text-white">
                      Transaction Confirmed - NFT Minted
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link
                      href={getSolanaExplorerUrl(txSignature)}
                      target="_blank"
                      className="flex items-center text-sm text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View on Explorer
                    </Link>
                    <button
                      onClick={() =>
                        copyToClipboard(txSignature, "Transaction ID")
                      }
                      className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
                      title="Copy Transaction ID"
                    >
                      {copiedTxId === txSignature ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-green-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="font-mono text-xs text-gray-400 break-all">
                  {txSignature}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
