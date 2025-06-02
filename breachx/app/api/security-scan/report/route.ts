import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';

const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function GET() {
  try {
    // List objects in the bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: 'security-scan-insight-reports',
      Prefix: 'reports/',
    });

    const listResponse = await s3Client.send(listCommand);
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      return NextResponse.json({ error: 'No reports found in bucket' }, { status: 404 });
    }

    // Sort by LastModified to get the most recent report
    const sortedContents = listResponse.Contents.sort((a, b) => {
      return (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0);
    });

    const latestReport = sortedContents[0];
    
    // Generate a presigned URL for the report
    const getCommand = new GetObjectCommand({
      Bucket: 'security-scan-insight-reports',
      Key: latestReport.Key,
    });

    // Get the presigned URL
    const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 }); // URL expires in 1 hour

    return NextResponse.json({ 
      reportUrl: url,
      lastModified: latestReport.LastModified?.toISOString()
    });
  } catch (error) {
    console.error('Error fetching security report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security report' },
      { status: 500 }
    );
  }
} 