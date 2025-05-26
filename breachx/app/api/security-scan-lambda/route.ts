import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { NextRequest, NextResponse } from 'next/server';

const lambdaClient = new LambdaClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function POST(request) {
  try {
    const { targetUrl } = await request.json();
    
    const params = {
      FunctionName: 'security-scanner-lambda', // Your Lambda function name
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        targetUrl,
        ecrImage: '273354655539.dkr.ecr.us-east-1.amazonaws.com/security-scanner:updated'
      }),
    };

    const command = new InvokeCommand(params);
    const response = await lambdaClient.send(command);
    
    const result = JSON.parse(Buffer.from(response.Payload).toString());
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error invoking Lambda:', error);
    return NextResponse.json(
      { error: 'Failed to start security scan' },
      { status: 500 }
    );
  }
}