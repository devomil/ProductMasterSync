/**
 * AWS Signature V4 implementation for Amazon SP-API
 */

import { createHash, createHmac } from 'crypto';

interface SignatureRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  service: string;
  region: string;
}

export async function createAWSSignature(request: SignatureRequest): Promise<Record<string, string>> {
  const accessKeyId = process.env.AMAZON_SP_API_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AMAZON_SP_API_SECRET_KEY;
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured. Please provide AMAZON_SP_API_ACCESS_KEY_ID and AMAZON_SP_API_SECRET_KEY');
  }

  const url = new URL(request.url);
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = timestamp.substr(0, 8);

  // Canonical request
  const canonicalUri = url.pathname;
  const canonicalQueryString = url.searchParams.toString();
  const canonicalHeaders = Object.entries(request.headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key.toLowerCase()}:${value}`)
    .join('\n') + '\n';
  
  const signedHeaders = Object.keys(request.headers)
    .map(key => key.toLowerCase())
    .sort()
    .join(';');

  const payloadHash = createHash('sha256').update(request.body || '').digest('hex');

  const canonicalRequest = [
    request.method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // String to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${date}/${request.region}/${request.service}/aws4_request`;
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  // Calculate signature
  const kDate = createHmac('sha256', `AWS4${secretAccessKey}`).update(date).digest();
  const kRegion = createHmac('sha256', kDate).update(request.region).digest();
  const kService = createHmac('sha256', kRegion).update(request.service).digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  // Authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'authorization': authorizationHeader,
    'x-amz-date': timestamp,
    'x-amz-content-sha256': payloadHash
  };
}