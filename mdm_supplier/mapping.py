"""
Mapping template functionality for supplier data integration
"""
import json
import logging
from typing import Dict, List, Any, Optional, Tuple, Union
import re

from mdm_supplier.models import SchemaValidationResult

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Default expected schema for product data
DEFAULT_PRODUCT_SCHEMA = {
    "sku": "string",
    "name": "string",
    "description": "string",
    "price": "number",
    "inventory": "number",
    "category": "string",
    "brand": "string",
    "upc": "string",
    "weight": "number",
    "dimensions": "object"
}

# Common field name mappings to help with automatic field detection
COMMON_FIELD_MAPPINGS = {
    # SKU field variations
    "sku": ["sku", "item_number", "product_id", "product_code", "item_code", "article_number", "part_number"],
    # Name field variations
    "name": ["name", "product_name", "title", "item_name", "description", "product_title", "product_description"],
    # Price field variations 
    "price": ["price", "unit_price", "retail_price", "cost", "wholesale_price", "msrp", "list_price"],
    # Inventory field variations
    "inventory": ["inventory", "stock", "quantity", "qty", "on_hand", "available", "stock_level"],
    # Category field variations
    "category": ["category", "department", "product_type", "product_category", "group", "product_group"],
    # Brand/manufacturer field variations
    "brand": ["brand", "manufacturer", "vendor", "supplier", "make", "producer"],
    # UPC/barcode field variations
    "upc": ["upc", "ean", "barcode", "gtin", "isbn"],
    # Weight field variations
    "weight": ["weight", "item_weight", "shipping_weight", "package_weight"],
    # Dimensions field variations
    "dimensions": ["dimensions", "size", "measurements", "package_dimensions", "shipping_dimensions"]
}


def detect_field_type(sample_values: List[Any]) -> str:
    """
    Detect the data type of a field based on sample values
    """
    if not sample_values:
        return "unknown"
    
    # Check the first few non-null values (up to 5)
    non_null_values = [v for v in sample_values if v is not None][:5]
    
    if not non_null_values:
        return "null"
    
    # Check if all values are numeric
    if all(isinstance(v, (int, float)) or (isinstance(v, str) and v.replace(".", "", 1).isdigit()) for v in non_null_values):
        return "number"
    
    # Check if all values are boolean
    if all(isinstance(v, bool) or (isinstance(v, str) and v.lower() in ["true", "false", "yes", "no", "0", "1"]) for v in non_null_values):
        return "boolean"
    
    # Check if values look like dates
    date_pattern = re.compile(r'^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}')
    if all(isinstance(v, str) and date_pattern.match(v) for v in non_null_values):
        return "date"
    
    # Check if values are objects/dictionaries
    if all(isinstance(v, dict) for v in non_null_values):
        return "object"
    
    # Check if values are arrays/lists
    if all(isinstance(v, list) for v in non_null_values):
        return "array"
    
    # Default to string
    return "string"


def validate_schema(data: List[Dict[str, Any]], expected_schema: Dict[str, str] = None) -> List[SchemaValidationResult]:
    """
    Validate sample data against an expected schema
    
    Args:
        data: List of records to validate
        expected_schema: Dictionary mapping field names to expected types
        
    Returns:
        List of validation results for each field
    """
    if not data:
        return []
    
    if expected_schema is None:
        expected_schema = DEFAULT_PRODUCT_SCHEMA
        
    # Extract field names from the first few records
    field_names = set()
    for record in data[:10]:  # Look at first 10 records
        field_names.update(record.keys())
    
    # Collect sample values for each field
    field_values = {field: [] for field in field_names}
    for record in data:
        for field in field_names:
            if field in record:
                field_values[field].append(record[field])
    
    # Validate each field
    results = []
    for field_name in field_names:
        sample_values = field_values[field_name]
        actual_type = detect_field_type(sample_values)
        expected_type = expected_schema.get(field_name, "unknown")
        
        # Special case for fields that should be numbers but come in as strings
        valid = (actual_type == expected_type) or \
                (expected_type == "number" and actual_type == "string" and 
                 all(str(v).replace(".", "", 1).isdigit() for v in sample_values if v is not None))
        
        # Sample value for display
        sample_value = sample_values[0] if sample_values else None
        
        # Add notes if needed
        notes = None
        if not valid:
            if expected_type != "unknown":
                notes = f"Expected {expected_type}, but found {actual_type}"
            else:
                notes = "Field not in expected schema"
        
        results.append(SchemaValidationResult(
            field_name=field_name,
            expected_type=expected_type,
            actual_type=actual_type,
            valid=valid,
            sample_value=sample_value,
            notes=notes
        ))
    
    return results


def suggest_mapping(data: List[Dict[str, Any]], mapping_templates: List[Dict[str, Any]] = None) -> Tuple[Optional[Dict[str, Any]], float]:
    """
    Suggest a mapping template for the given data and calculate a confidence score
    
    Args:
        data: Sample data records
        mapping_templates: Available mapping templates to consider
        
    Returns:
        Tuple of (suggested_mapping, confidence_score)
    """
    if not data or not mapping_templates:
        return None, 0.0
        
    # Extract field names from the data
    field_names = set()
    for record in data[:10]:  # Look at first 10 records
        field_names.update(record.keys())
    
    best_template = None
    best_score = 0.0
    
    for template in mapping_templates:
        # Skip templates without mappings
        if "mappings" not in template or not template["mappings"]:
            continue
            
        # Extract source fields from the template
        template_fields = set()
        for mapping in template["mappings"]:
            if isinstance(mapping, dict) and "sourceField" in mapping:
                template_fields.add(mapping["sourceField"])
        
        # Calculate match score based on field overlap
        if not template_fields:  # Avoid division by zero
            continue
            
        # Count exact matches
        exact_matches = len(field_names.intersection(template_fields))
        
        # Count fuzzy matches using common field name variations
        fuzzy_matches = 0
        for field in field_names:
            for standard_field, variations in COMMON_FIELD_MAPPINGS.items():
                if field in variations and any(tf in template_fields for tf in variations):
                    fuzzy_matches += 0.5  # Give partial credit for fuzzy matches
        
        # Calculate overall score
        # 70% weight on exact matches, 30% on fuzzy matches
        total_fields = max(len(field_names), len(template_fields))
        if total_fields == 0:  # Avoid division by zero
            continue
            
        score = (0.7 * exact_matches / total_fields) + (0.3 * fuzzy_matches / total_fields)
        
        if score > best_score:
            best_score = score
            
            # Create a mapping suggestion
            suggestion = {
                "template_id": template.get("id"),
                "template_name": template.get("name"),
                "field_mappings": {},
                "exact_matches": exact_matches,
                "total_fields": total_fields
            }
            
            # Add field mappings
            for mapping in template["mappings"]:
                if isinstance(mapping, dict) and "sourceField" in mapping and "destinationField" in mapping:
                    source = mapping["sourceField"]
                    dest = mapping["destinationField"]
                    
                    # Check for exact match
                    if source in field_names:
                        suggestion["field_mappings"][source] = dest
                    else:
                        # Check for match using common variations
                        for standard_field, variations in COMMON_FIELD_MAPPINGS.items():
                            if source in variations:
                                for field in field_names:
                                    if field in variations:
                                        suggestion["field_mappings"][field] = dest
                                        break
            
            best_template = suggestion
    
    return best_template, best_score


def apply_filters(data: List[Dict[str, Any]], filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Apply filters to the data
    
    Args:
        data: The data to filter
        filters: Dictionary of filter criteria
        
    Returns:
        Filtered data
    """
    if not filters or not data:
        return data
        
    filtered_data = data.copy()
    
    # Apply category filter
    if "category" in filters and filters["category"]:
        filtered_data = [
            record for record in filtered_data 
            if "category" in record and record["category"] == filters["category"]
        ]
    
    # Apply SKU prefix filter
    if "sku_prefix" in filters and filters["sku_prefix"]:
        prefix = filters["sku_prefix"]
        filtered_data = [
            record for record in filtered_data 
            if any(str(record.get(field, "")).startswith(prefix) 
                   for field in ["sku", "product_id", "item_number", "part_number"])
        ]
    
    # Apply field contains filters
    if "field_contains" in filters and filters["field_contains"]:
        for field, value in filters["field_contains"].items():
            if value:
                filtered_data = [
                    record for record in filtered_data 
                    if field in record and value.lower() in str(record[field]).lower()
                ]
    
    # Apply limit
    limit = filters.get("limit", 100)
    return filtered_data[:limit]