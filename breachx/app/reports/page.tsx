"use client";

import { useEffect, useState } from "react";
import {
  useConnection,
  useWallet,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import {
  getProgram,
  storeVulnerabilityReport,
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
  Copy,
  Check,
} from "lucide-react";
import { formatDate, getSolanaExplorerUrl, truncateAddress } from "@/lib/utils";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import * as anchor from "@coral-xyz/anchor";
import { Anchor } from "@/lib/contract/types/anchor";

interface PageProps {
  searchParams: {
    pdfUrl?: string;
    repoUrl?: string;
  };
}

export default function DemoPage({ searchParams }: PageProps) {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [program, setProgram] = useState<anchor.Program<Anchor> | null>(null);
  const [userReports, setUserReports] = useState<ReportWithTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [storingReport, setStoringReport] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reportUrl, setReportUrl] = useState<string>(searchParams.pdfUrl || '');
  const [repositoryUrl, setRepositoryUrl] = useState<string>(searchParams.repoUrl || '');

  useEffect(() => {
    if (searchParams.pdfUrl) {
      setReportUrl(searchParams.pdfUrl);
    }
    if (searchParams.repoUrl) {
      setRepositoryUrl(searchParams.repoUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (connected && anchorWallet) {
      const init = async () => {
        try {
          const programInstance = await getProgram(anchorWallet, connection);
          setProgram(programInstance);
          await fetchUserReports(programInstance);
        } catch (error) {
          console.error("Error initializing program:", error);
        }
      };
      init();
    }
  }, [connected, anchorWallet, connection]);

  const fetchUserReports = async (programInstance: anchor.Program<Anchor>) => {
    if (!publicKey) return;
    try {
      const reports = await getUserVulnerabilityReports(programInstance, publicKey);
      setUserReports(reports);
    } catch (error) {
      console.error("Error fetching user reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStoreReport = async () => {
    if (!program || !publicKey || !reportUrl || !repositoryUrl) return;

    setStoringReport(true);
    try {
      const { tx } = await storeVulnerabilityReport(
        program,
        repositoryUrl,
        reportUrl
      );
      setTxSignature(tx);
      await fetchUserReports(program);
    } catch (error) {
      console.error("Error storing report:", error);
    } finally {
      setStoringReport(false);
    }
  };

  const copyToClipboard = async () => {
    if (txSignature) {
      await navigator.clipboard.writeText(txSignature);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Security Reports</h1>
          <Link href="/dashboard">
            <Button variant="outline" className="text-white">
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="grid gap-8">
          <Card className="bg-gray-900/60 border border-gray-800 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-white">
                Store New Report
              </CardTitle>
              <CardDescription>
                Store your security report on the Solana blockchain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reportUrl">Report URL</Label>
                <Input
                  id="reportUrl"
                  value={reportUrl}
                  onChange={(e) => setReportUrl(e.target.value)}
                  placeholder="Enter the URL of your security report"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repositoryUrl">Repository URL</Label>
                <Input
                  id="repositoryUrl"
                  value={repositoryUrl}
                  onChange={(e) => setRepositoryUrl(e.target.value)}
                  placeholder="Enter the URL of your repository"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button
                onClick={handleStoreReport}
                disabled={!connected || storingReport || !reportUrl || !repositoryUrl}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-md"
              >
                {storingReport ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Storing Report...
                  </>
                ) : (
                  "Store Report"
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-gray-900/60 border border-gray-800 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-white">
                Your Reports
              </CardTitle>
              <CardDescription>
                View your stored vulnerability reports
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
                    Connect your wallet to view your reports
                  </p>
                </div>
              ) : userReports.length > 0 ? (
                <div className="space-y-4">
                  {userReports.map((reportItem, index) => (
                    <div
                      key={index}
                      className="bg-gray-950/70 rounded-lg p-4 border border-gray-800/60"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs text-gray-500">
                          Repository ID
                        </span>
                        <div className="px-2 py-1 bg-purple-900/40 rounded-full text-purple-400 text-xs">
                          Verified on Solana
                        </div>
                      </div>

                      <div className="text-lg font-medium text-white mb-2">
                        {reportItem.report.repositoryId}
                      </div>

                      <a
                        href={reportItem.report.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-medium text-blue-400 hover:underline flex items-center"
                      >
                        {reportItem.report.reportUrl}
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>

                      <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                        <span>
                          Stored on {formatDate(new Date(reportItem.report.timestamp.toNumber() * 1000))}
                        </span>
                        <a
                          href={getSolanaExplorerUrl(reportItem.transactionId || '')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300"
                        >
                          View Transaction
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                  <Image
                    src="/placeholder-report.svg"
                    alt="No reports found"
                    width={120}
                    height={120}
                    className="opacity-50"
                  />
                  <p className="text-center text-gray-400">
                    No vulnerability reports found for this wallet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {txSignature && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-4">
              Recent Transaction
            </h2>
            <Card className="bg-gray-900/60 border border-gray-800 shadow-xl overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400">
                      {truncateAddress(txSignature)}
                    </span>
                    <button
                      onClick={copyToClipboard}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <a
                    href={getSolanaExplorerUrl(txSignature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
