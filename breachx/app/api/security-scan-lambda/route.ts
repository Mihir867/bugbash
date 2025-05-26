import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { NextRequest, NextResponse } from 'next/server';

const lambdaClient = new LambdaClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(request: NextRequest) {
  try {
    const { targetUrl }: { targetUrl: string } = await request.json();
    
    const params = {
      FunctionName: 'security-scanner-lambda', // Your Lambda function name
      InvocationType: 'RequestResponse' as const,
      Payload: JSON.stringify({
        targetUrl,
        ecrImage: '273354655539.dkr.ecr.us-east-1.amazonaws.com/security-scanner:updated'
      }),
    };

    const command = new InvokeCommand(params);
    const response = await lambdaClient.send(command);
    
    if (!response.Payload) {
      throw new Error('No payload received from Lambda function');
    }
    
    const result = JSON.parse(Buffer.from(response.Payload).toString());
    
    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error('Error invoking Lambda:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to start security scan', details: errorMessage },
      { status: 500 }
    );
  }
}