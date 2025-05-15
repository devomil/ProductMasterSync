import { ValidationRule } from '@shared/schema';

/**
 * Performs validation on a record using the provided validation rules
 * @param record The record to validate
 * @param mappings Field mappings from source to target
 * @param validationRules Validation rules to apply
 * @returns Object containing validation results and transformed record
 */
export function validateAndTransformRecord(
  record: Record<string, any>,
  mappings: Record<string, string>,
  validationRules: ValidationRule[]
): { 
  isValid: boolean; 
  errors: Array<{ field: string; message: string }>; 
  warnings: Array<{ field: string; message: string }>;
  transformedRecord: Record<string, any> 
} {
  const result = {
    isValid: true,
    errors: [] as Array<{ field: string; message: string }>,
    warnings: [] as Array<{ field: string; message: string }>,
    transformedRecord: {} as Record<string, any>
  };

  // Reverse the mappings to go from source field to target field
  const sourceToTargetMap = new Map<string, string>();
  Object.entries(mappings).forEach(([sourceField, targetField]) => {
    sourceToTargetMap.set(sourceField, targetField);
  });

  // Initialize transformed record with mapped values
  Object.entries(record).forEach(([sourceField, value]) => {
    const targetField = sourceToTargetMap.get(sourceField);
    if (targetField) {
      result.transformedRecord[targetField] = value;
    }
  });

  // Apply validation rules
  for (const rule of validationRules) {
    const { field, type, message, errorLevel, value, defaultValue } = rule;
    
    // Check if the field exists in the transformed record
    const fieldValue = result.transformedRecord[field];
    const fieldExists = field in result.transformedRecord;

    // Process based on rule type
    switch (type) {
      case 'required':
        if (!fieldExists || fieldValue === null || fieldValue === undefined || fieldValue === '') {
          if (errorLevel === 'error') {
            result.errors.push({ 
              field, 
              message: message || `Field ${field} is required` 
            });
            result.isValid = false;
          } else {
            result.warnings.push({ 
              field, 
              message: message || `Field ${field} is recommended` 
            });
          }
          
          // Apply default value if available
          if (defaultValue !== undefined) {
            result.transformedRecord[field] = defaultValue;
          }
        }
        break;
        
      case 'type':
        if (fieldExists && fieldValue !== null && fieldValue !== undefined) {
          let typeValidation = true;
          let typedValue: any = fieldValue;
          
          // Attempt to convert to the expected type
          try {
            switch (value) {
              case 'string':
                typedValue = String(fieldValue);
                break;
                
              case 'integer':
                typedValue = parseInt(fieldValue, 10);
                if (isNaN(typedValue)) {
                  typeValidation = false;
                }
                break;
                
              case 'float':
                typedValue = parseFloat(fieldValue);
                if (isNaN(typedValue)) {
                  typeValidation = false;
                }
                break;
                
              case 'boolean':
                if (typeof fieldValue === 'string') {
                  const lowered = fieldValue.toLowerCase();
                  if (['true', 'yes', '1', 'y'].includes(lowered)) {
                    typedValue = true;
                  } else if (['false', 'no', '0', 'n'].includes(lowered)) {
                    typedValue = false;
                  } else {
                    typeValidation = false;
                  }
                } else if (typeof fieldValue === 'number') {
                  typedValue = fieldValue !== 0;
                } else if (typeof fieldValue !== 'boolean') {
                  typeValidation = false;
                }
                break;
                
              case 'date':
                const dateValue = new Date(fieldValue);
                if (isNaN(dateValue.getTime())) {
                  typeValidation = false;
                } else {
                  typedValue = dateValue;
                }
                break;
                
              default:
                // Unknown type, consider it valid
                break;
            }
            
            // Update the value with the converted type
            if (typeValidation) {
              result.transformedRecord[field] = typedValue;
            }
          } catch (error) {
            typeValidation = false;
          }
          
          // Add validation error/warning if type validation failed
          if (!typeValidation) {
            if (errorLevel === 'error') {
              result.errors.push({ 
                field, 
                message: message || `Field ${field} must be a valid ${value}` 
              });
              result.isValid = false;
            } else {
              result.warnings.push({ 
                field, 
                message: message || `Field ${field} should be a valid ${value}` 
              });
            }
            
            // Apply default value if available and type validation failed
            if (defaultValue !== undefined) {
              result.transformedRecord[field] = defaultValue;
            }
          }
        }
        break;
        
      case 'custom':
        // Handle custom validation rules
        if (value === 'setDefaultIfMissing' && defaultValue !== undefined) {
          if (!fieldExists || fieldValue === null || fieldValue === undefined || fieldValue === '') {
            result.transformedRecord[field] = defaultValue;
            
            if (errorLevel === 'warning') {
              result.warnings.push({ 
                field, 
                message: message || `Using default value for ${field}` 
              });
            }
          }
        }
        break;
    }
  }

  return result;
}

/**
 * Apply validation rules to a collection of records
 * @param records Array of records to validate
 * @param mappings Field mappings from source to target
 * @param validationRules Validation rules to apply
 * @returns Validation results and transformed records
 */
export function validateAndTransformRecords(
  records: Record<string, any>[],
  mappings: Record<string, string>,
  validationRules: ValidationRule[]
): {
  validRecords: Record<string, any>[];
  invalidRecords: Array<{ 
    record: Record<string, any>; 
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ field: string; message: string }>;
  }>;
} {
  const result = {
    validRecords: [] as Record<string, any>[],
    invalidRecords: [] as Array<{
      record: Record<string, any>;
      errors: Array<{ field: string; message: string }>;
      warnings: Array<{ field: string; message: string }>;
    }>
  };

  for (const record of records) {
    const validationResult = validateAndTransformRecord(record, mappings, validationRules);
    
    if (validationResult.isValid) {
      result.validRecords.push(validationResult.transformedRecord);
    } else {
      result.invalidRecords.push({
        record,
        errors: validationResult.errors,
        warnings: validationResult.warnings
      });
    }
  }

  return result;
}