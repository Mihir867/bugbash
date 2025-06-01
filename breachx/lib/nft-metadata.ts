export interface NFTMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
  };
}

export function generateSecurityBadgeMetadata(
  repositoryId: string,
  reportUrl: string,
  timestamp: number
): NFTMetadata {
  const repoName = repositoryId.split("/").pop() || repositoryId;

  return {
    name: `BreachX Security Badge - ${repoName}`,
    symbol: "BXSB",
    description: `Security verification badge for ${repositoryId}. This NFT represents a verified security audit conducted on ${new Date(
      timestamp * 1000
    ).toLocaleDateString()}.`,
    image: "http://localhost:3000/api/nft-image/security-badge.png", // You'll need to host this
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
}

export async function uploadMetadataToIPFS(
  metadata: NFTMetadata
): Promise<string> {
  // Replace with Pinata upload
  try {
    const response = await fetch("/api/upload-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      throw new Error("Failed to upload metadata");
    }

    const result = await response.json();
    return result.uri;
  } catch (error) {
    console.error("Error uploading metadata:", error);
    // Fallback to a temporary URI for development
    return `data:application/json;base64,${btoa(JSON.stringify(metadata))}`;
  }
}
