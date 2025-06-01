import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const metadata = await request.json();

    // Replace with Pinata upload
    const mockUpload = {
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description,
      image: metadata.image,
      attributes: metadata.attributes,
      properties: metadata.properties,
    };

    // Replace this with Pinata hash
    const dataUri = `data:application/json;base64,${Buffer.from(
      JSON.stringify(mockUpload)
    ).toString("base64")}`;

    /*
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: mockUpload,
        pinataMetadata: {
          name: `BreachX-Security-Badge-${Date.now()}`,
        },
      }),
    });
    
    if (!pinataResponse.ok) {
      throw new Error('Failed to upload to IPFS');
    }
    
    const pinataData = await pinataResponse.json();
    const ipfsUri = `https://gateway.pinata.cloud/ipfs/${pinataData.IpfsHash}`;
    
    return NextResponse.json({ uri: ipfsUri });
    */

    return NextResponse.json({ uri: dataUri });
  } catch (error) {
    console.error("Error uploading metadata:", error);
    return NextResponse.json(
      { error: "Failed to upload metadata" },
      { status: 500 }
    );
  }
}
