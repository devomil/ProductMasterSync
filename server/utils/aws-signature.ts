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
  const accessKeyId = process.env.AMAZON_SP_API_AWS_ACCESS_KEY;
  const secretAccessKey = process.env.AMAZON_SP_API_AWS_SECRET_KEY;
  
  if (!accessKeyId || !secretAccessKey) {
    console.error('[AWS Signature] Missing credentials:', {
      hasAccessKey: !!accessKeyId,
      hasSecretKey: !!secretAccessKey
    });
    throw new Error('AWS credentials not configured. Please provide AMAZON_SP_API_AWS_ACCESS_KEY and AMAZON_SP_API_AWS_SECRET_KEY');
  }
  
  console.log('[AWS Signature] Creating signature with Access Key:', accessKeyId.substring(0, 8) + '...');

  const url = new URL(request.url);
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = timestamp.substr(0, 8);

  // Canonical request
  const canonicalUri = url.pathname;
  
  // Build canonical query string with RFC-3986 encoding and alphabetical sorting
  // Amazon requires parameters to be sorted lexicographically and RFC-3986 encoded
  const canonicalQueryString = Array.from(url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      // RFC-3986 encoding: encode special chars including spaces as %20 (not +)
      const encodedKey = encodeURIComponent(key).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
      const encodedValue = encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
      return `${encodedKey}=${encodedValue}`;
    })
    .join('&');
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