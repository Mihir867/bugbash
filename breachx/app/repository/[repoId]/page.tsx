/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import type React from "react";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Terminal,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import BuildLogStream from "@/components/ui/buildstream";
import SecurityLogStream from "@/components/ui/securitystream";

// Define types for our data structures
interface RepositoryConfig {
  id: string;
  repositoryId: string;
  hasDocker: boolean;
  dockerConfig?: string;
  rootDirectory?: string;
  buildCommand?: string;
  runCommand?: string;
  environmentVariables?: any;
  buildStatus?: string;
  lastBuildId?: string;
  lastBuildStartTime?: string;
  deploymentUrl?: string;
  createdAt: string;
  updatedAt: string;
  installCommand?: string;
}

interface BuildStatus {
  id: string;
  buildNumber: string;
  status: string;
  startTime: string;
  endTime?: string;
  currentPhase: string;
  phaseStatus: string;
  logStreamName?: string;
  logGroupName?: string;
}

interface Repository {
  id: string;
  repoId: string;
  name: string;
  description?: string;
  url: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  config?: RepositoryConfig;
  repository: any;
}

interface LastBuildInfo {
  lastBuildId: string;
  buildStatus: string;
  lastBuildStartTime: string;
}

export default function RepositoryDetail() {
  const { repoId } = useParams();
  const { data: session, status } = useSession();
  const router = useRouter();

  const [repository, setRepository] = useState<null | Repository>(null);
  const [repoConfig, setRepoConfig] = useState<null | RepositoryConfig>(null);
  const [loading, setLoading] = useState(true);
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildMessage, setBuildMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false); // Dialog doesn't open automatically
  const [activeTab, setActiveTab] = useState<"details" | "logs" | "security">(
    "details"
  );
  const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);
  const [lastBuildInfo, setLastBuildInfo] = useState<LastBuildInfo | null>(
    null
  );
  const [currentBuildId, setCurrentBuildId] = useState<string | null>(null);

  // Add effect to switch to security tab when deployment URL is available
  useEffect(() => {
    if (repoConfig?.deploymentUrl) {
      setActiveTab("security");
    }
  }, [repoConfig?.deploymentUrl]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in");
    }
  }, [status, router]);

  useEffect(() => {
    if (session && repoId) {
      fetchRepositoryDetails();
    }
  }, [session, repoId]);

  // Fetch last build information when repository details are loaded
  useEffect(() => {
    if (repoConfig?.lastBuildId) {
      fetchLastBuildInfo();
      setCurrentBuildId(repoConfig.lastBuildId);
    }
  }, [repoConfig]);

  // Fetch build status when currentBuildId changes
  useEffect(() => {
    if (currentBuildId) {
      fetchBuildStatus(currentBuildId);

      // Set up polling for build status
      const statusInterval = setInterval(() => {
        fetchBuildStatus(currentBuildId);
      }, 10000); // Poll every 10 seconds

      return () => {
        clearInterval(statusInterval);
      };
    }
  }, [currentBuildId]);

  const fetchLastBuildInfo = async () => {
    if (!repoId || typeof repoId !== "string") return;

    try {
      const response = await fetch(`/api/repositories/${repoId}/lastBuild`);

      if (!response.ok) {
        if (response.status !== 404) {
          // It's okay if there are no builds yet
          console.error(
            "Failed to fetch last build info:",
            response.statusText
          );
        }
        return;
      }

      const data = await response.json();
      setLastBuildInfo(data);

      // Set current build ID if it's not already set
      if (!currentBuildId && data.lastBuildId) {
        setCurrentBuildId(data.lastBuildId);
      }
    } catch (error) {
      console.error("Error fetching last build info:", error);
    }
  };

  const fetchBuildStatus = async (buildId: string) => {
    try {
      const response = await fetch(`/api/builds/${buildId}/status`);

      if (!response.ok) {
        throw new Error(`Failed to fetch build status: ${response.statusText}`);
      }

      const data = await response.json();
      setBuildStatus(data);

      // If the build is complete, update the repository details
      if (["SUCCEEDED", "FAILED", "STOPPED"].includes(data.status)) {
        fetchRepositoryDetails();
      }
    } catch (error) {
      console.error("Error fetching build status:", error);
    }
  };

  // We don't need fetchBuildLogs anymore as we're using WebSockets via BuildLogStream

  const fetchRepositoryDetails = async () => {
    try {
      const repoResponse = await fetch(`/api/repoConfig/${repoId}`);
      if (!repoResponse.ok) {
        throw new Error("Repository not found");
      }

      const repoData = await repoResponse.json();
      setRepository(repoData);

      const configResponse = await fetch(`/api/repoConfig/${repoId}`);
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setRepoConfig(configData);
      }
    } catch (error) {
      console.error("Error fetching repository details:", error);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const triggerBuild = async () => {
    setBuildLoading(true);
    setBuildMessage(null);

    try {
      const response = await fetch(`/api/repositories/${repoId}/build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        // Set the current build ID to the new build
        setCurrentBuildId(data.buildId);

        // Automatically switch to logs tab
        setActiveTab("logs");

        // Refresh the repository config to get updated build status
        fetchRepositoryDetails();

        // Close the dialog after successful build trigger
        setDialogOpen(false);
      } else {
        setBuildMessage({
          type: "error",
          text: data.error || "Failed to trigger build",
        });
      }
    } catch (error) {
      console.error("Error triggering build:", error);
      setBuildMessage({
        type: "error",
        text: "An error occurred while triggering the build",
      });
    } finally {
      setBuildLoading(false);
    }
  };

  // We don't need refreshLogs anymore as the BuildLogStream component handles this

  const getBuildStatusBadge = (status?: string) => {
    if (!status) return null;

    const statusVariants: Record<
      string,
      {
        variant: "outline" | "secondary" | "destructive" | "default";
        icon: React.ReactNode;
      }
    > = {
      PENDING: {
        variant: "secondary",
        icon: <Clock className="h-3 w-3 mr-1" />,
      },
      BUILDING: {
        variant: "secondary",
        icon: <Terminal className="h-3 w-3 mr-1" />,
      },
      IN_PROGRESS: {
        variant: "secondary",
        icon: <Terminal className="h-3 w-3 mr-1" />,
      },
      DEPLOYED: {
        variant: "default",
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
      },
      SUCCEEDED: {
        variant: "default",
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
      },
      FAILED: {
        variant: "destructive",
        icon: <XCircle className="h-3 w-3 mr-1" />,
      },
      STOPPED: {
        variant: "outline",
        icon: <XCircle className="h-3 w-3 mr-1" />,
      },
    };

    const { variant, icon } = statusVariants[status] || {
      variant: "outline",
      icon: null,
    };

    return (
      <Badge variant={variant} className="flex items-center">
        {icon}
        {status}
      </Badge>
    );
  };

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-screen bg-black text-foreground flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-r-2 border-purple-500 animate-spin animate-reverse"></div>
          <div className="absolute inset-4 rounded-full border-b-2 border-teal-500 animate-spin animate-delay-500"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-blue-400 animate-pulse" />
          </div>
        </div>
        <h3 className="mt-8 text-xl font-medium text-white animate-pulse">Loading your workspace</h3>
        <p className="mt-2 text-gray-400">Preparing your development environment...</p>
      </div>
        </motion.div>
      </div>
    );
  }

  if (!session) return null;

  if (!repository) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-screen bg-black text-foreground">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card rounded-lg shadow-md p-8 text-center"
        >
          <h2 className="text-xl font-semibold mb-4">Repository not found</h2>
          <p className="text-muted-foreground mb-6">
            You may not have access to this repository.
          </p>
          <Button asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-8 pt-20 min-h-screen bg-black text-foreground">
      <AnimatePresence>
        {dialogOpen && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Trigger Build</DialogTitle>
                <DialogDescription>
                  Do you want to trigger a new build for{" "}
                  {repository.repository.name}?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Not now
                </Button>
                <Button
                  onClick={triggerBuild}
                  disabled={buildLoading}
                  className="flex items-center gap-2"
                >
                  {buildLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background"></div>
                      Building...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Trigger Build
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6">
          <Button variant="ghost" asChild className="gap-1">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <Card className="overflow-hidden min-h-[900px]">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">
                  {repository.repository.name}
                </CardTitle>

                {repository.repository.description && (
                  <CardDescription className="mt-2">
                    {repository.repository.description}
                  </CardDescription>
                )}
              </div>

              <div>
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Trigger Build
                </Button>
              </div>
            </div>

            {buildMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-3 rounded ${
                  buildMessage.type === "success"
                    ? "bg-green-900/20 text-green-400"
                    : "bg-black text-white"
                }`}
              >
                {buildMessage.text}
              </motion.div>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" asChild className="gap-2">
                <a
                  href={repository.repository.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GitBranch className="h-4 w-4" />
                  View on GitHub
                </a>
              </Button>

              {repoConfig?.deploymentUrl && (
                <Button variant="outline" asChild className="gap-2">
                  <a
                    href={repoConfig.deploymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Deployment
                  </a>
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="border-t border-border pt-4">
              <div className="flex mb-6 border-b border-border">
                <Button
                  variant={activeTab === "details" ? "default" : "ghost"}
                  onClick={() => setActiveTab("details")}
                  className="rounded-none rounded-t-lg"
                >
                  Repository Details
                </Button>
                <Button
                  variant={activeTab === "logs" ? "default" : "ghost"}
                  onClick={() => setActiveTab("logs")}
                  className="rounded-none rounded-t-lg"
                >
                  Build Logs
                </Button>
                <Button
                  variant={activeTab === "security" ? "default" : "ghost"}
                  onClick={() => setActiveTab("security")}
                  className="rounded-none rounded-t-lg"
                >
                  Security Logs
                </Button>
              </div>
              {activeTab === "details" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold">
                      Repository Information
                    </h2>
                    {repoConfig?.buildStatus &&
                      getBuildStatusBadge(repoConfig.buildStatus)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-muted-foreground">Added on</p>
                      <p className="font-medium">
                        {new Date(repository.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last updated</p>
                      <p className="font-medium">
                        {new Date(repository.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {repoConfig?.lastBuildStartTime && (
                      <div>
                        <p className="text-muted-foreground">Last build</p>
                        <p className="font-medium">
                          {new Date(
                            repoConfig.lastBuildStartTime
                          ).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {repoConfig?.lastBuildId && (
                      <div>
                        <p className="text-muted-foreground">Build ID</p>
                        <p className="font-medium">{repoConfig.lastBuildId}</p>
                      </div>
                    )}
                  </div>

                  {repoConfig && (
                    <div className="border-t border-border pt-4">
                      <h2 className="text-lg font-semibold mb-3">
                        Build Configuration
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-muted-foreground">
                            Root Directory
                          </p>
                          <p className="font-medium">
                            {repoConfig.rootDirectory || "Not specified"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Build Command</p>
                          <p className="font-medium">
                            {repoConfig.buildCommand || "Not specified"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Run Command</p>
                          <p className="font-medium">
                            {repoConfig.runCommand || "Not specified"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Install Command
                          </p>
                          <p className="font-medium">
                            {repoConfig.installCommand || "Not specified"}
                          </p>
                        </div>
                      </div>

                      {repoConfig.environmentVariables && (
                        <div className="mt-4">
                          <p className="text-muted-foreground mb-2">
                            Environment Variables
                          </p>
                          <div className="bg-card/50 p-3 rounded-md border border-border">
                            {Object.entries(
                              repoConfig.environmentVariables
                            ).map(([key]) => (
                              <div
                                key={key}
                                className="flex items-center mb-1 last:mb-0"
                              >
                                <span className="font-medium mr-2">{key}:</span>
                                <span className="text-muted-foreground">
                                  ●●●●●●●●
                                </span>
                              </div>
                            ))}
                            {Object.entries(repoConfig.environmentVariables)
                              .length === 0 && (
                              <p className="text-muted-foreground italic">
                                No environment variables configured
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
              {activeTab === "logs" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">Build Logs</h2>
                      {buildStatus && getBuildStatusBadge(buildStatus.status)}
                    </div>
                  </div>

                  {/* Display build status information */}
                  {buildStatus && (
                    <div className="grid grid-cols-1 text-white md:grid-cols-3 gap-4 bg-black p-4 rounded-md">
                      <div>
                        <p className="text-muted-foreground text-sm">
                          Build Number
                        </p>
                        <p className="font-medium">{buildStatus.buildNumber}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm">
                          Current Phase
                        </p>
                        <p className="font-medium">
                          {buildStatus.currentPhase}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm">
                          Phase Status
                        </p>
                        <p className="font-medium">{buildStatus.phaseStatus}</p>
                      </div>
                    </div>
                  )}

                  {/* Use BuildLogStream component for WebSocket-based log streaming */}
                  <BuildLogStream
                    buildId={currentBuildId || ""}
                    maxHeight="400px"
                    autoScroll={true}
                  />
                </motion.div>
              )}
              {activeTab === "security" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Use BuildLogStream component for WebSocket-based log streaming */}
                  <SecurityLogStream
                    deploymentUrl={repoConfig?.deploymentUrl || ""}
                    maxHeight="500px"
                    autoScroll={true}
                  />
                </motion.div>
              )}{" "}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
