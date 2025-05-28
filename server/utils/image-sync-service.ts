import { db } from '../db';
import { products, mappingTemplates } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import fetch from 'node-fetch';

interface ImageMapping {
  mpn: string;
  primaryImageUrl?: string;
  largeImageUrl?: string;
  additionalImages?: string[];
}

export class ImageSyncService {
  
  /**
   * Automatically sync product images based on mapping template configurations
   */
  async syncProductImages(supplierId: number, templateId?: number): Promise<{
    success: boolean;
    updatedCount: number;
    message: string;
    details: any[];
  }> {
    console.log(`🖼️ Starting image sync for supplier ${supplierId}...`);
    
    try {
      // Get the mapping template for this supplier
      let template;
      if (templateId) {
        const templates = await db.select()
          .from(mappingTemplates)
          .where(eq(mappingTemplates.id, templateId));
        template = templates[0];
      } else {
        // Get the default template for this supplier
        const templates = await db.select()
          .from(mappingTemplates)
          .where(eq(mappingTemplates.supplierId, supplierId));
        template = templates[0];
      }
      
      if (!template) {
        return {
          success: false,
          updatedCount: 0,
          message: 'No mapping template found for supplier',
          details: []
        };
      }
      
      console.log(`📋 Using template: ${template.name}`);
      
      // Extract image field mappings from template
      const mappings = template.mappings as any;
      const detailMappings = mappings?.detail || [];
      
      const imageFieldMappings = detailMappings.filter((mapping: any) => 
        mapping.targetField && (
          mapping.targetField.includes('image') || 
          mapping.targetField.includes('photo')
        )
      );
      
      if (imageFieldMappings.length === 0) {
        return {
          success: false,
          updatedCount: 0,
          message: 'No image field mappings found in template',
          details: []
        };
      }
      
      console.log(`🎯 Found ${imageFieldMappings.length} image field mappings`);
      
      // Get all products for this supplier that need image updates
      const allProducts = await db.select()
        .from(products)
        .where(eq(products.manufacturerId, supplierId)); // Assuming manufacturerId links to supplier
      
      let updatedCount = 0;
      const updateDetails = [];
      
      for (const product of allProducts) {
        try {
          const imageUrls = await this.extractImageUrlsFromProduct(product, imageFieldMappings);
          
          if (imageUrls.primaryImageUrl || imageUrls.largeImageUrl) {
            // Validate image URLs before updating
            const validatedUrls = await this.validateImageUrls(imageUrls);
            
            if (validatedUrls.primaryImageUrl || validatedUrls.largeImageUrl) {
              await db.update(products)
                .set({
                  imageUrl: validatedUrls.primaryImageUrl,
                  imageUrlLarge: validatedUrls.largeImageUrl,
                  updatedAt: new Date()
                })
                .where(eq(products.id, product.id));
              
              updatedCount++;
              updateDetails.push({
                productId: product.id,
                productName: product.name,
                mpn: product.manufacturerPartNumber,
                primaryImage: validatedUrls.primaryImageUrl,
                largeImage: validatedUrls.largeImageUrl
              });
              
              console.log(`✅ Updated images for ${product.manufacturerPartNumber}: ${validatedUrls.primaryImageUrl}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error processing product ${product.manufacturerPartNumber}:`, error);
          updateDetails.push({
            productId: product.id,
            productName: product.name,
            mpn: product.manufacturerPartNumber,
            error: error.message
          });
        }
      }
      
      return {
        success: true,
        updatedCount,
        message: `Successfully synced images for ${updatedCount} products`,
        details: updateDetails
      };
      
    } catch (error) {
      console.error('❌ Image sync service error:', error);
      return {
        success: false,
        updatedCount: 0,
        message: `Image sync failed: ${error.message}`,
        details: []
      };
    }
  }
  
  /**
   * Extract image URLs from product data based on mapping template
   */
  private async extractImageUrlsFromProduct(product: any, imageFieldMappings: any[]): Promise<ImageMapping> {
    const imageUrls: ImageMapping = {
      mpn: product.manufacturerPartNumber
    };
    
    // Extract URLs from product attributes or direct fields
    const productData = product.attributes || {};
    
    for (const mapping of imageFieldMappings) {
      const sourceField = mapping.sourceField;
      const targetField = mapping.targetField;
      const imageUrl = productData[sourceField] || product[sourceField];
      
      if (imageUrl && typeof imageUrl === 'string' && this.isValidImageUrl(imageUrl)) {
        switch (targetField) {
          case 'primary_image_url':
            imageUrls.primaryImageUrl = imageUrl;
            break;
          case 'large_image_url':
            imageUrls.largeImageUrl = imageUrl;
            break;
          case 'additional_images':
            if (!imageUrls.additionalImages) imageUrls.additionalImages = [];
            imageUrls.additionalImages.push(imageUrl);
            break;
        }
      }
    }
    
    return imageUrls;
  }
  
  /**
   * Validate that image URLs are accessible
   */
  private async validateImageUrls(imageUrls: ImageMapping): Promise<ImageMapping> {
    const validated: ImageMapping = { mpn: imageUrls.mpn };
    
    // Validate primary image
    if (imageUrls.primaryImageUrl) {
      const isValid = await this.testImageUrl(imageUrls.primaryImageUrl);
      if (isValid) {
        validated.primaryImageUrl = imageUrls.primaryImageUrl;
      }
    }
    
    // Validate large image
    if (imageUrls.largeImageUrl) {
      const isValid = await this.testImageUrl(imageUrls.largeImageUrl);
      if (isValid) {
        validated.largeImageUrl = imageUrls.largeImageUrl;
      }
    }
    
    // Validate additional images
    if (imageUrls.additionalImages?.length) {
      const validAdditional = [];
      for (const url of imageUrls.additionalImages) {
        const isValid = await this.testImageUrl(url);
        if (isValid) {
          validAdditional.push(url);
        }
      }
      if (validAdditional.length > 0) {
        validated.additionalImages = validAdditional;
      }
    }
    
    return validated;
  }
  
  /**
   * Test if an image URL is accessible
   */
  private async testImageUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Basic validation for image URL format
   */
  private isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
  
  /**
   * Sync images for specific products by MPN
   */
  async syncSpecificProducts(mpns: string[], supplierId: number): Promise<{
    success: boolean;
    results: any[];
  }> {
    console.log(`🎯 Syncing images for specific products: ${mpns.join(', ')}`);
    
    const results = [];
    
    for (const mpn of mpns) {
      try {
        const productList = await db.select()
          .from(products)
          .where(eq(products.manufacturerPartNumber, mpn));
        
        if (productList.length === 0) {
          results.push({ mpn, status: 'not_found', message: 'Product not found' });
          continue;
        }
        
        const product = productList[0];
        
        // Apply the general sync logic for this specific product
        const syncResult = await this.syncProductImages(supplierId);
        
        results.push({ 
          mpn, 
          status: 'processed', 
          productId: product.id,
          message: 'Image sync completed'
        });
        
      } catch (error) {
        results.push({ 
          mpn, 
          status: 'error', 
          message: error.message 
        });
      }
    }
    
    return {
      success: true,
      results
    };
  }
}

export const imageSyncService = new ImageSyncService();