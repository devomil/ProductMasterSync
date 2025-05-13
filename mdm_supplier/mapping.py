"""
Schema validation and mapping suggestion module
"""
import re
import logging
from typing import Dict, List, Any, Tuple, Optional
from difflib import SequenceMatcher
from models import SchemaValidationResult

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def validate_schema(sample_data: List[Dict[str, Any]]) -> List[SchemaValidationResult]:
    """
    Validate sample data against expected schema
    
    Args:
        sample_data: List of sample data records
        
    Returns:
        List of validation results for each field
    """
    if not sample_data:
        return []
    
    # Extract all field names from the sample data
    field_names = set()
    for record in sample_data:
        field_names.update(record.keys())
    
    validation_results = []
    
    # Loop through each field and validate its type
    for field_name in field_names:
        # Get the values for this field from all records
        field_values = [record.get(field_name) for record in sample_data if field_name in record]
        
        if not field_values:
            continue
        
        # Determine the predominant type of the field
        type_counts = {}
        for value in field_values:
            if value is None:
                value_type = "null"
            else:
                value_type = type(value).__name__
            
            type_counts[value_type] = type_counts.get(value_type, 0) + 1
        
        # Get the most common type (excluding null)
        non_null_types = {t: c for t, c in type_counts.items() if t != "null"}
        
        if non_null_types:
            actual_type = max(non_null_types.items(), key=lambda x: x[1])[0]
        else:
            actual_type = "null"
        
        # Get a sample value (non-null if possible)
        sample_value = next((v for v in field_values if v is not None), field_values[0])
        
        # Determine expected type based on field name heuristics
        expected_type = _infer_expected_type(field_name)
        
        # Check if the actual type matches the expected type
        is_valid = _is_type_valid(actual_type, expected_type)
        
        # Create validation result
        notes = None
        if not is_valid:
            notes = f"Expected {expected_type}, found {actual_type}"
            
            # Add additional context for specific type mismatches
            if expected_type == "float" and actual_type == "str":
                # Check if string could be converted to float
                try:
                    float_value = float(sample_value)
                    notes += f". Value '{sample_value}' could be converted to float: {float_value}"
                    is_valid = True
                except (ValueError, TypeError):
                    notes += f". Value '{sample_value}' could not be converted to float."
            
            elif expected_type == "int" and actual_type == "str":
                # Check if string could be converted to int
                try:
                    int_value = int(sample_value)
                    notes += f". Value '{sample_value}' could be converted to int: {int_value}"
                    is_valid = True
                except (ValueError, TypeError):
                    notes += f". Value '{sample_value}' could not be converted to int."
            
            elif expected_type == "date" and actual_type == "str":
                import datetime
                
                # Try multiple date formats
                date_formats = [
                    "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d",
                    "%d-%m-%Y", "%m-%d-%Y", "%b %d, %Y", "%d %b %Y"
                ]
                
                for fmt in date_formats:
                    try:
                        date_value = datetime.datetime.strptime(sample_value, fmt).date()
                        notes += f". Value '{sample_value}' could be parsed as date: {date_value} using format {fmt}"
                        is_valid = True
                        break
                    except (ValueError, TypeError):
                        pass
                
                if not is_valid:
                    notes += f". Value '{sample_value}' could not be parsed as a date."
        
        validation_results.append(
            SchemaValidationResult(
                field_name=field_name,
                expected_type=expected_type,
                actual_type=actual_type,
                valid=is_valid,
                sample_value=str(sample_value) if sample_value is not None else None,
                notes=notes
            )
        )
    
    return validation_results


def _infer_expected_type(field_name: str) -> str:
    """
    Infer the expected data type based on field name
    
    Args:
        field_name: Name of the field
        
    Returns:
        Expected data type
    """
    # Convert field name to lowercase for case-insensitive matching
    field_lower = field_name.lower()
    
    # Price related fields
    if any(price_term in field_lower for price_term in ["price", "cost", "msrp", "map", "discount", "amount"]):
        return "float"
    
    # Quantity related fields
    if any(qty_term in field_lower for qty_term in ["qty", "quantity", "count", "stock", "inventory", "units"]):
        return "int"
    
    # Date related fields
    if any(date_term in field_lower for date_term in ["date", "created", "updated", "modified", "time", "timestamp"]):
        return "date"
    
    # Boolean fields
    if any(bool_term in field_lower for bool_term in ["is_", "has_", "active", "enabled", "flag", "status", "available"]):
        return "bool"
    
    # ID fields
    if field_lower.endswith("_id") or field_lower == "id" or field_lower.endswith("id"):
        # Check if it seems to be a UUID
        if "uuid" in field_lower:
            return "uuid"
        return "str"  # Default to string for IDs
    
    # Default to string for most fields
    return "str"


def _is_type_valid(actual_type: str, expected_type: str) -> bool:
    """
    Check if the actual type is valid for the expected type
    
    Args:
        actual_type: Actual data type
        expected_type: Expected data type
        
    Returns:
        True if the type is valid, False otherwise
    """
    # Direct match
    if actual_type == expected_type:
        return True
    
    # Acceptable numeric type substitutions
    if expected_type == "float" and actual_type in ["int", "float"]:
        return True
    
    if expected_type == "int" and actual_type == "int":
        return True
    
    # Boolean can be represented as int or string in some systems
    if expected_type == "bool" and actual_type in ["bool", "int"]:
        return True
    
    # Date can be string in many systems before parsing
    if expected_type == "date" and actual_type == "str":
        return True  # We'll do more detailed validation elsewhere
    
    # IDs are often strings
    if expected_type in ["id", "uuid"] and actual_type == "str":
        return True
    
    return False


def suggest_mapping(
    sample_data: List[Dict[str, Any]], 
    mapping_templates: List[Dict[str, Any]]
) -> Tuple[Optional[Dict[str, Any]], float]:
    """
    Suggest a mapping template based on sample data
    
    Args:
        sample_data: List of sample data records
        mapping_templates: List of mapping templates
        
    Returns:
        Tuple of (suggested mapping, confidence score)
    """
    if not sample_data or not mapping_templates:
        return None, 0.0
    
    # Extract field names from the sample data
    sample_fields = set()
    for record in sample_data:
        sample_fields.update(record.keys())
    
    best_template = None
    best_score = 0.0
    
    for template in mapping_templates:
        template_id = template.get('id')
        template_name = template.get('name', 'Unknown Template')
        template_fields = []
        
        # Extract template fields from mappings
        if isinstance(template.get('mappings'), str):
            import json
            try:
                mappings = json.loads(template.get('mappings', '[]'))
                if isinstance(mappings, list):
                    template_fields = [mapping.get('sourceField') for mapping in mappings if mapping.get('sourceField')]
            except (json.JSONDecodeError, AttributeError):
                logger.warning(f"Could not parse mappings for template {template_name}")
                continue
        elif isinstance(template.get('mappings'), list):
            template_fields = [mapping.get('sourceField') for mapping in template.get('mappings', []) 
                              if mapping.get('sourceField')]
        
        if not template_fields:
            continue
        
        # Calculate exact match score (70% weight)
        exact_matches = 0
        for field in template_fields:
            if field in sample_fields:
                exact_matches += 1
        
        exact_match_score = exact_matches / len(template_fields) if template_fields else 0
        
        # Calculate fuzzy match score for fields that didn't match exactly (30% weight)
        fuzzy_match_score = 0
        non_exact_fields = [field for field in template_fields if field not in sample_fields]
        
        if non_exact_fields:
            total_fuzzy_score = 0
            
            for template_field in non_exact_fields:
                best_field_score = 0
                
                for sample_field in sample_fields:
                    # Skip if this is an exact match (already counted)
                    if template_field == sample_field:
                        continue
                    
                    # Calculate string similarity
                    similarity = SequenceMatcher(None, template_field.lower(), sample_field.lower()).ratio()
                    
                    # Check for substring matches (e.g., "sku" in "product_sku")
                    if template_field.lower() in sample_field.lower() or sample_field.lower() in template_field.lower():
                        similarity = max(similarity, 0.8)  # Boost similarity for substring matches
                    
                    if similarity > best_field_score:
                        best_field_score = similarity
                
                total_fuzzy_score += best_field_score
            
            fuzzy_match_score = total_fuzzy_score / len(non_exact_fields) if non_exact_fields else 0
        
        # Combined score: 70% exact match, 30% fuzzy match
        combined_score = (exact_match_score * 0.7) + (fuzzy_match_score * 0.3)
        
        if combined_score > best_score:
            field_matches = []
            
            # Collect exact matches
            for template_field in template_fields:
                if template_field in sample_fields:
                    field_matches.append({
                        "templateField": template_field,
                        "sampleField": template_field,
                        "matchType": "exact",
                        "confidence": 1.0
                    })
            
            # Collect fuzzy matches
            for template_field in non_exact_fields:
                best_match = None
                best_match_score = 0
                
                for sample_field in sample_fields:
                    # Skip exact matches (already handled)
                    if template_field == sample_field:
                        continue
                    
                    similarity = SequenceMatcher(None, template_field.lower(), sample_field.lower()).ratio()
                    
                    # Check for substring matches
                    if template_field.lower() in sample_field.lower() or sample_field.lower() in template_field.lower():
                        similarity = max(similarity, 0.8)
                    
                    if similarity > best_match_score and similarity > 0.6:  # Only include good matches
                        best_match_score = similarity
                        best_match = sample_field
                
                if best_match:
                    field_matches.append({
                        "templateField": template_field,
                        "sampleField": best_match,
                        "matchType": "fuzzy",
                        "confidence": best_match_score
                    })
            
            best_template = {
                "template_id": template_id,
                "template_name": template_name,
                "field_matches": field_matches,
                "exact_match_score": exact_match_score,
                "fuzzy_match_score": fuzzy_match_score,
                "combined_score": combined_score
            }
            best_score = combined_score
    
    return best_template, best_score