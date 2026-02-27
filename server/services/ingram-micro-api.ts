import axios, { AxiosInstance } from 'axios';

interface IngramMicroConfig {
  clientId: string;
  clientSecret: string;
  customerNumber: string;
  countryCode: string;
  baseUrl: string;
  sandboxBaseUrl: string;
  useSandbox: boolean;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface IngramProduct {
  description: string;
  category: string;
  subCategory: string;
  productType: string;
  ingramPartNumber: string;
  vendorPartNumber: string;
  upcCode: string;
  vendorName: string;
  endUserRequired: string;
  hasDiscounts: string;
  type: string;
  discontinued: string;
  newProduct: string;
  directShip: string;
  hasWarranty: string;
  replacementSku: string;
  authorizedToPurchase: string;
  links?: any[];
}

export interface IngramProductDetail {
  ingramPartNumber: string;
  vendorPartNumber: string;
  vendorName: string;
  description: string;
  productCategory: string;
  productSubCategory: string;
  vendorNumber: string;
  productStatusCode: string;
  productClass: string;
  indicators?: {
    hasWarranty: boolean;
    isNewProduct: boolean;
    isDiscontinued: boolean;
    isDirectShip: boolean;
    isDownloadable: boolean;
    isDigitalType: boolean;
    hasReturnLimits: boolean;
    refurbished: boolean;
    isEndUserRequired: boolean;
    isHeavyWeight: boolean;
  };
  ciscoFields?: any;
  technicalSpecifications?: any[];
  warrantyInformation?: any[];
  additionalInformation?: any;
}

export interface IngramPriceAvailability {
  productStatusCode: string;
  productStatusMessage: string;
  ingramPartNumber: string;
  vendorPartNumber: string;
  vendorName: string;
  description: string;
  upc: string;
  availability: {
    available: boolean;
    totalAvailability: number;
    availabilityByWarehouse?: {
      location: string;
      warehouseId: string;
      quantityAvailable: number;
      quantityBackordered?: number;
      backOrderInfo?: any;
    }[];
  };
  pricing: {
    mapPrice?: number;
    currencyCode: string;
    retailPrice?: number;
    customerPrice?: number;
  };
  bundlePartIndicator?: boolean;
}

export interface IngramOrderCreateShipToInfo {
  addressId?: string;
  contact?: string;
  companyName?: string;
  name1?: string;
  name2?: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  phoneNumber?: string;
  email?: string;
}

export interface IngramOrderCreateLine {
  customerLineNumber: string;
  ingramPartNumber: string;
  quantity: number;
  specialBidNumber?: string;
  notes?: string;
  unitPrice?: number;
  endUserPrice?: number;
}

export interface IngramOrderCreateRequest {
  customerOrderNumber: string;
  endCustomerOrderNumber?: string;
  billToAddressId?: string;
  specialBidNumber?: string;
  notes?: string;
  shipToInfo: IngramOrderCreateShipToInfo;
  lines: IngramOrderCreateLine[];
  additionalAttributes?: {
    attributeName: string;
    attributeValue: string;
  }[];
  vmfAdditionalAttributes?: {
    attributeName: string;
    attributeValue: string;
  }[];
  resellerInfo?: {
    resellerId?: string;
    companyName?: string;
    contact?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
    phoneNumber?: string;
    email?: string;
  };
  endUserInfo?: {
    endUserId?: string;
    contact?: string;
    companyName?: string;
    name1?: string;
    name2?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
    phoneNumber?: string;
    email?: string;
  };
}

export interface IngramOrderCreateResponseLine {
  subOrderNumber?: string;
  ingramOrderLineNumber?: string;
  customerLineNumber?: string;
  lineStatus?: string;
  ingramPartNumber?: string;
  vendorPartNumber?: string;
  quantity?: number;
  unitPrice?: number;
  extendedUnitPrice?: number;
  shipmentDetails?: {
    carrierCode?: string;
    carrierName?: string;
    freightAccountNumber?: string;
    shipFromWarehouseId?: string;
    shipFromLocation?: string;
  };
  notes?: string;
}

export interface IngramOrderCreateResponse {
  ingramOrderNumber: string;
  customerOrderNumber: string;
  orderTotal?: number;
  orderStatus?: string;
  lines?: IngramOrderCreateResponseLine[];
  additionalAttributes?: {
    attributeName: string;
    attributeValue: string;
  }[];
  notes?: string;
}

export interface IngramOrderCreateError {
  errorCode?: string;
  errorMessage?: string;
  fields?: {
    field: string;
    message: string;
  }[];
}

export interface IngramOrderSearchResult {
  ingramOrderNumber: string;
  ingramOrderDate: string;
  customerOrderNumber: string;
  vendorSalesOrderNumber: string;
  vendorName: string;
  endUserCompanyName: string;
  orderTotal: number;
  orderStatus: string;
  subOrders?: any[];
  links?: any[];
}

export class IngramMicroAPI {
  private config: IngramMicroConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private client: AxiosInstance;

  constructor() {
    this.config = {
      clientId: process.env.INGRAM_MICRO_CLIENT_ID || '',
      clientSecret: process.env.INGRAM_MICRO_CLIENT_SECRET || '',
      customerNumber: process.env.INGRAM_MICRO_CUSTOMER_NUMBER || '',
      countryCode: 'US',
      baseUrl: 'https://api.ingrammicro.com:443',
      sandboxBaseUrl: 'https://api.ingrammicro.com:443/sandbox',
      useSandbox: (process.env.INGRAM_MICRO_USE_SANDBOX || 'false') === 'true',
    };

    this.client = axios.create({
      timeout: 30000,
    });
  }

  isConfigured(): boolean {
    return !!(this.config.clientId && this.config.clientSecret && this.config.customerNumber);
  }

  private getBaseUrl(): string {
    return this.config.useSandbox ? this.config.sandboxBaseUrl : this.config.baseUrl;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      console.log('[Ingram Micro] Requesting access token...');
      const response = await this.client.get<TokenResponse>(
        `${this.config.baseUrl}/oauth/oauth30/token`,
        {
          params: {
            grant_type: 'client_credentials',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000) - 60000);
      console.log('[Ingram Micro] Access token obtained successfully');
      return this.accessToken;
    } catch (error: any) {
      console.error('[Ingram Micro] Token request failed:', error.response?.data || error.message);
      throw new Error(`Ingram Micro authentication failed: ${error.response?.data?.message || error.message}`);
    }
  }

  private getHeaders(correlationId?: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'IM-CustomerNumber': this.config.customerNumber,
      'IM-CountryCode': this.config.countryCode,
      'IM-CorrelationID': correlationId || `MDM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      'IM-ApplicationID': 'MDM-PIM-Platform',
      'IM-CustomerContact': process.env.INGRAM_MICRO_CONTACT_EMAIL || 'support@multichannelos.com',
    };
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    params: Record<string, any> = {},
    body: any = null,
    correlationId?: string
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    const url = `${this.getBaseUrl()}${path}`;
    const headers = {
      ...this.getHeaders(correlationId),
      'Authorization': `Bearer ${accessToken}`,
    };

    try {
      console.log(`[Ingram Micro] ${method} ${path}`);
      const response = await this.client({
        method,
        url,
        headers,
        params: method === 'GET' ? params : undefined,
        data: body || undefined,
        validateStatus: () => true,
      });

      if (response.status >= 400) {
        console.error(`[Ingram Micro] Error ${response.status}:`, JSON.stringify(response.data).slice(0, 500));
        throw new Error(`Ingram Micro API returned ${response.status}: ${JSON.stringify(response.data)}`);
      }

      return response.data;
    } catch (error: any) {
      if (error.message?.includes('Ingram Micro API returned')) throw error;
      console.error(`[Ingram Micro] Request failed: ${method} ${path}`, error.message);
      throw new Error(`Ingram Micro API request failed: ${error.message}`);
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; tokenValid: boolean }> {
    try {
      if (!this.isConfigured()) {
        return { success: false, message: 'Ingram Micro credentials not configured', tokenValid: false };
      }
      await this.getAccessToken();
      return { success: true, message: 'Connected to Ingram Micro API successfully', tokenValid: true };
    } catch (error: any) {
      return { success: false, message: error.message, tokenValid: false };
    }
  }

  async searchProducts(opts: {
    keyword?: string;
    vendorPartNumber?: string;
    vendor?: string;
    category?: string;
    pageNumber?: number;
    pageSize?: number;
  }): Promise<{ catalog: IngramProduct[]; recordsFound: number }> {
    const params: Record<string, any> = {};
    if (opts.keyword) params.keyword = opts.keyword;
    if (opts.vendorPartNumber) params.vendorPartNumber = opts.vendorPartNumber;
    if (opts.vendor) params.vendor = opts.vendor;
    if (opts.category) params.category = opts.category;
    if (opts.pageNumber) params.pageNumber = opts.pageNumber;
    if (opts.pageSize) params.pageSize = opts.pageSize;

    const response = await this.makeRequest<any>('GET', '/resellers/v6/catalog', params);
    return {
      catalog: response?.catalog || [],
      recordsFound: response?.recordsFound || 0,
    };
  }

  async getProductDetails(ingramPartNumber: string): Promise<IngramProductDetail> {
    return this.makeRequest<IngramProductDetail>(
      'GET',
      `/resellers/v6/catalog/details/${encodeURIComponent(ingramPartNumber)}`
    );
  }

  async getPriceAndAvailability(products: { ingramPartNumber: string }[]): Promise<IngramPriceAvailability[]> {
    const body = {
      showAvailableDiscounts: true,
      showReserveInventoryDetails: true,
      specialBidNumber: '',
      products: products.map(p => ({ ingramPartNumber: p.ingramPartNumber })),
    };

    const accessToken = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/resellers/v6/catalog/priceandavailability?includeAvailability=true&includePricing=true&includeProductAttributes=true`;
    const headers = {
      ...this.getHeaders(),
      'Authorization': `Bearer ${accessToken}`,
    };

    try {
      console.log(`[Ingram Micro] POST /resellers/v6/catalog/priceandavailability`);
      const response = await this.client({
        method: 'POST',
        url,
        headers,
        data: body,
        validateStatus: () => true,
      });

      if (response.status >= 400) {
        console.error(`[Ingram Micro] Error ${response.status}:`, JSON.stringify(response.data).slice(0, 500));
        throw new Error(`Ingram Micro API returned ${response.status}: ${JSON.stringify(response.data)}`);
      }

      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      if (error.message?.includes('Ingram Micro API returned')) throw error;
      throw new Error(`Ingram Micro price check failed: ${error.message}`);
    }
  }

  async searchOrders(opts: {
    ingramOrderNumber?: string;
    customerOrderNumber?: string;
    orderStatus?: string;
    orderFromDate?: string;
    orderToDate?: string;
    pageNumber?: number;
    pageSize?: number;
  }): Promise<{ orders: IngramOrderSearchResult[]; recordsFound: number }> {
    const params: Record<string, any> = {};
    if (opts.ingramOrderNumber) params.ingramOrderNumber = opts.ingramOrderNumber;
    if (opts.customerOrderNumber) params.customerOrderNumber = opts.customerOrderNumber;
    if (opts.orderStatus) params.orderStatus = opts.orderStatus;
    if (opts.orderFromDate) params.orderFromDate = opts.orderFromDate;
    if (opts.orderToDate) params.orderToDate = opts.orderToDate;
    if (opts.pageNumber) params.pageNumber = opts.pageNumber;
    if (opts.pageSize) params.pageSize = opts.pageSize;

    const response = await this.makeRequest<any>('GET', '/resellers/v6/orders/search', params);
    return {
      orders: response?.orders || [],
      recordsFound: response?.recordsFound || 0,
    };
  }

  async getOrderDetails(orderNumber: string): Promise<any> {
    return this.makeRequest<any>(
      'GET',
      `/resellers/v6.1/orders/${encodeURIComponent(orderNumber)}`
    );
  }

  async searchInvoices(opts: {
    invoiceNumber?: string;
    invoiceStatus?: string;
    invoiceType?: string;
    invoiceFromDate?: string;
    invoiceToDate?: string;
  }): Promise<any> {
    const params: Record<string, any> = {};
    if (opts.invoiceNumber) params.invoiceNumber = opts.invoiceNumber;
    if (opts.invoiceStatus) params.invoiceStatus = opts.invoiceStatus;
    if (opts.invoiceType) params.invoiceType = opts.invoiceType;
    if (opts.invoiceFromDate) params.invoiceFromDate = opts.invoiceFromDate;
    if (opts.invoiceToDate) params.invoiceToDate = opts.invoiceToDate;

    return this.makeRequest<any>('GET', '/resellers/v6/invoices', params);
  }

  async getInvoiceDetails(invoiceNumber: string): Promise<any> {
    return this.makeRequest<any>(
      'GET',
      `/resellers/v6.1/invoices/${encodeURIComponent(invoiceNumber)}`
    );
  }

  async getFreightEstimate(body: {
    shipToAddress: { postalCode: string; countryCode: string };
    lines: { ingramPartNumber: string; quantity: number }[];
  }): Promise<any> {
    const requestBody = {
      shipToAddressId: '',
      shipToAddress: {
        postalCode: body.shipToAddress.postalCode,
        countryCode: body.shipToAddress.countryCode,
      },
      lines: body.lines.map((l, i) => ({
        ingramPartNumber: l.ingramPartNumber,
        quantity: l.quantity.toString(),
        customerLineNumber: (i + 1).toString(),
      })),
    };

    return this.makeRequest<any>('POST', '/resellers/v6/freightestimate', {}, requestBody);
  }

  async createOrder(request: IngramOrderCreateRequest): Promise<IngramOrderCreateResponse> {
    if (!request.customerOrderNumber) {
      throw new Error('customerOrderNumber is required to create an order');
    }
    if (!request.shipToInfo || !request.shipToInfo.addressLine1 || !request.shipToInfo.city || !request.shipToInfo.state || !request.shipToInfo.postalCode || !request.shipToInfo.countryCode) {
      throw new Error('Complete shipping address is required (addressLine1, city, state, postalCode, countryCode)');
    }
    if (!request.lines || request.lines.length === 0) {
      throw new Error('At least one order line with an ingramPartNumber is required');
    }
    for (const line of request.lines) {
      if (!line.ingramPartNumber) {
        throw new Error(`Order line ${line.customerLineNumber} is missing ingramPartNumber`);
      }
      if (!line.quantity || line.quantity < 1) {
        throw new Error(`Order line ${line.customerLineNumber} has invalid quantity`);
      }
    }

    const orderBody: Record<string, any> = {
      customerOrderNumber: request.customerOrderNumber,
      endCustomerOrderNumber: request.endCustomerOrderNumber || request.customerOrderNumber,
      billToAddressId: request.billToAddressId || this.config.customerNumber,
      notes: request.notes || '',
      shipToInfo: request.shipToInfo,
      lines: request.lines.map((line) => ({
        customerLineNumber: line.customerLineNumber,
        ingramPartNumber: line.ingramPartNumber,
        quantity: line.quantity,
        ...(line.specialBidNumber ? { specialBidNumber: line.specialBidNumber } : {}),
        ...(line.notes ? { notes: line.notes } : {}),
        ...(line.unitPrice != null ? { unitPrice: line.unitPrice } : {}),
        ...(line.endUserPrice != null ? { endUserPrice: line.endUserPrice } : {}),
      })),
    };

    if (request.specialBidNumber) {
      orderBody.specialBidNumber = request.specialBidNumber;
    }
    if (request.additionalAttributes && request.additionalAttributes.length > 0) {
      orderBody.additionalAttributes = request.additionalAttributes;
    }
    if (request.vmfAdditionalAttributes && request.vmfAdditionalAttributes.length > 0) {
      orderBody.vmfAdditionalAttributes = request.vmfAdditionalAttributes;
    }
    if (request.resellerInfo) {
      orderBody.resellerInfo = request.resellerInfo;
    }
    if (request.endUserInfo) {
      orderBody.endUserInfo = request.endUserInfo;
    }

    const correlationId = `MDM-ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      console.log(`[Ingram Micro] Creating order for customerOrderNumber: ${request.customerOrderNumber} with ${request.lines.length} line(s)`);

      const response = await this.makeRequest<IngramOrderCreateResponse>(
        'POST',
        '/resellers/v6/orders',
        {},
        orderBody,
        correlationId
      );

      console.log(`[Ingram Micro] Order created successfully. Ingram Order Number: ${response.ingramOrderNumber}`);
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';

      if (errorMessage.includes('400')) {
        const parsed = this.parseOrderError(errorMessage);
        if (parsed.includes('part number') || parsed.includes('SKU')) {
          throw new Error(`Invalid Ingram part number in order: ${parsed}`);
        }
        if (parsed.includes('address')) {
          throw new Error(`Shipping address validation failed: ${parsed}`);
        }
        throw new Error(`Order validation error: ${parsed}`);
      }

      if (errorMessage.includes('409')) {
        throw new Error(`Duplicate order: customerOrderNumber "${request.customerOrderNumber}" may already exist`);
      }

      if (errorMessage.includes('404')) {
        throw new Error(`One or more Ingram part numbers not found. Verify part numbers are valid and available.`);
      }

      if (errorMessage.includes('429')) {
        throw new Error(`Ingram Micro API rate limit exceeded. Please retry in a few moments.`);
      }

      if (errorMessage.includes('500') || errorMessage.includes('503')) {
        throw new Error(`Ingram Micro service temporarily unavailable. Please retry later.`);
      }

      throw new Error(`Failed to create Ingram Micro order: ${errorMessage}`);
    }
  }

  private parseOrderError(errorMessage: string): string {
    try {
      const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as IngramOrderCreateError;
        if (parsed.errorMessage) return parsed.errorMessage;
        if (parsed.fields && parsed.fields.length > 0) {
          return parsed.fields.map(f => `${f.field}: ${f.message}`).join('; ');
        }
      }
    } catch {
    }
    return errorMessage;
  }
}

export const ingramMicroAPI = new IngramMicroAPI();
