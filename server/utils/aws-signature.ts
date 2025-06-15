/**
 * AWS Signature Version 4 Implementation for Amazon SP-API
 * Required for proper authentication to Amazon marketplace APIs
 */

import crypto from 'crypto';

interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}

export class AWSSignatureV4 {
  private credentials: AWSCredentials;

  constructor(credentials: AWSCredentials) {
    this.credentials = credentials;
  }

  private createCanonicalRequest(
    method: string,
    path: string,
    queryParams: string,
    headers: Record<string, string>,
    payload: string
  ): string {
    // Create canonical headers
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n') + '\n';

    // Create signed headers
    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    // Create payload hash
    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

    return [
      method,
      path,
      queryParams,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
  }

  private createStringToSign(
    timestamp: string,
    credentialScope: string,
    canonicalRequest: string
  ): string {
    const hashedCanonicalRequest = crypto.createHash('sha256')
      .update(canonicalRequest)
      .digest('hex');

    return [
      'AWS4-HMAC-SHA256',
      timestamp,
      credentialScope,
      hashedCanonicalRequest
    ].join('\n');
  }

  private calculateSignature(
    secretKey: string,
    dateStamp: string,
    regionName: string,
    serviceName: string,
    stringToSign: string
  ): string {
    const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`)
      .update(dateStamp)
      .digest();
    
    const kRegion = crypto.createHmac('sha256', kDate)
      .update(regionName)
      .digest();
    
    const kService = crypto.createHmac('sha256', kRegion)
      .update(serviceName)
      .digest();
    
    const kSigning = crypto.createHmac('sha256', kService)
      .update('aws4_request')
      .digest();
    
    return crypto.createHmac('sha256', kSigning)
      .update(stringToSign)
      .digest('hex');
  }

  signRequest(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    payload: string = ''
  ): Record<string, string> {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const queryParams = urlObj.search.slice(1); // Remove the '?'

    // Create timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = timestamp.slice(0, 8);

    // Add required headers
    const allHeaders = {
      'host': urlObj.hostname,
      'x-amz-date': timestamp,
      ...headers
    };

    // Create credential scope
    const credentialScope = `${dateStamp}/${this.credentials.region}/${this.credentials.service}/aws4_request`;

    // Create canonical request
    const canonicalRequest = this.createCanonicalRequest(
      method,
      path,
      queryParams,
      allHeaders,
      payload
    );

    // Create string to sign
    const stringToSign = this.createStringToSign(
      timestamp,
      credentialScope,
      canonicalRequest
    );

    // Calculate signature
    const signature = this.calculateSignature(
      this.credentials.secretAccessKey,
      dateStamp,
      this.credentials.region,
      this.credentials.service,
      stringToSign
    );

    // Create authorization header
    const signedHeaders = Object.keys(allHeaders)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const authorizationHeader = [
      'AWS4-HMAC-SHA256',
      `Credential=${this.credentials.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`
    ].join(', ');

    return {
      ...allHeaders,
      'Authorization': authorizationHeader
    };
  }
}

export function createAWSSignature(): AWSSignatureV4 {
  const credentials = {
    accessKeyId: process.env.AMAZON_SP_API_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AMAZON_SP_API_SECRET_KEY!,
    region: 'us-east-1',
    service: 'execute-api'
  };

  return new AWSSignatureV4(credentials);
}