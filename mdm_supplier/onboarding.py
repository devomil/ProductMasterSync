"""
Supplier onboarding automation module
"""
import json
import logging
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

from fastapi import UploadFile
from pydantic import ValidationError

from mdm_supplier.db import SupplierRepository
from mdm_supplier.models import Supplier, SupplierCreate, TestPullFilter
from mdm_supplier.mapping import suggest_mapping, validate_schema
from mdm_supplier.connectors import create_connector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define upload directory for file uploads
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class OnboardingResult:
    """Results of an automated supplier onboarding process"""
    
    def __init__(self):
        self.supplier_id: Optional[str] = None
        self.supplier_data: Optional[Dict[str, Any]] = None
        self.file_uploaded: bool = False
        self.file_path: Optional[str] = None
        self.test_pull_success: bool = False
        self.test_pull_data: Optional[List[Dict[str, Any]]] = None
        self.schema_validation: Optional[List[Dict[str, Any]]] = None
        self.mapping_suggestion: Optional[Dict[str, Any]] = None
        self.mapping_confidence: float = 0.0
        self.errors: List[Dict[str, Any]] = []
        self.steps_completed: int = 0
        self.total_steps: int = 4  # Create supplier, upload file, test pull, validate
        
    def add_error(self, step: str, message: str, details: Any = None):
        """Add an error that occurred during onboarding"""
        self.errors.append({
            "step": step,
            "message": message,
            "details": details
        })
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert the result to a dictionary"""
        return {
            "supplier_id": self.supplier_id,
            "supplier_data": self.supplier_data,
            "file_uploaded": self.file_uploaded,
            "file_path": self.file_path,
            "test_pull_success": self.test_pull_success,
            "sample_data_count": len(self.test_pull_data) if self.test_pull_data else 0,
            "sample_data": self.test_pull_data[:10] if self.test_pull_data else None,  # Limit to 10 records
            "schema_validation": self.schema_validation,
            "mapping_suggestion": self.mapping_suggestion,
            "mapping_confidence": self.mapping_confidence,
            "errors": self.errors,
            "progress": {
                "steps_completed": self.steps_completed,
                "total_steps": self.total_steps,
                "percentage": int((self.steps_completed / self.total_steps) * 100)
            },
            "status": "success" if self.steps_completed == self.total_steps else 
                     "partial_success" if self.steps_completed > 0 else "failed",
            "timestamp": datetime.now().isoformat()
        }


async def onboard_supplier(
    supplier_data: Dict[str, Any], 
    file: Optional[UploadFile] = None,
    file_config: Optional[Dict[str, Any]] = None
) -> OnboardingResult:
    """
    Automated supplier onboarding process
    
    Args:
        supplier_data: Supplier information
        file: Optional file upload
        file_config: Configuration for file processing
        
    Returns:
        OnboardingResult with onboarding status and results
    """
    result = OnboardingResult()
    
    try:
        # Step 1: Create supplier
        try:
            # Generate an ID and timestamps
            if 'id' not in supplier_data:
                supplier_data['id'] = str(uuid.uuid4())
                
            if 'created_at' not in supplier_data:
                supplier_data['created_at'] = datetime.now()
                
            if 'updated_at' not in supplier_data:
                supplier_data['updated_at'] = datetime.now()
            
            # Create supplier using repository
            created_supplier = SupplierRepository.create_supplier(supplier_data)
            
            if not created_supplier:
                result.add_error("create_supplier", "Failed to create supplier in database")
                return result
                
            result.supplier_id = created_supplier.get('id')
            result.supplier_data = created_supplier
            result.steps_completed += 1
            
        except ValidationError as e:
            result.add_error("create_supplier", "Invalid supplier data", e.errors())
            return result
            
        except Exception as e:
            result.add_error("create_supplier", f"Error creating supplier: {str(e)}")
            return result
        
        # Step 2: Upload and configure file if provided
        if file and file_config:
            try:
                # Validate file extension
                file_extension = file.filename.split('.')[-1].lower()
                allowed_extensions = file_config.get('allowed_extensions', ['csv', 'xlsx', 'xls'])
                
                if file_extension not in allowed_extensions:
                    result.add_error(
                        "file_upload",
                        f"File extension .{file_extension} is not allowed. Allowed: {', '.join(allowed_extensions)}"
                    )
                    return result
                
                # Save the file
                file_path = os.path.join(UPLOAD_DIR, f"{result.supplier_id}_{file.filename}")
                
                with open(file_path, "wb") as buffer:
                    file_content = await file.read()
                    buffer.write(file_content)
                
                # Update the supplier's data_sources configuration
                supplier = SupplierRepository.get_supplier_by_id(result.supplier_id)
                
                if supplier.get('data_sources') and isinstance(supplier['data_sources'], str):
                    data_sources = json.loads(supplier['data_sources'])
                else:
                    data_sources = {}
                    
                # If data_sources is null or not a dict, initialize it
                if not data_sources or not isinstance(data_sources, dict):
                    data_sources = {}
                
                # Update the file_upload configuration
                data_sources['file_upload'] = file_config
                
                # Update the supplier
                update_data = {'data_sources': data_sources}
                SupplierRepository.update_supplier(result.supplier_id, update_data)
                
                result.file_uploaded = True
                result.file_path = file_path
                result.steps_completed += 1
                
            except Exception as e:
                result.add_error("file_upload", f"Error uploading file: {str(e)}")
                # Continue with onboarding process even if file upload fails
        else:
            # Skip file upload step if no file provided
            result.steps_completed += 1
        
        # Step 3: Test pull data
        try:
            # Get the updated supplier with data sources
            supplier = SupplierRepository.get_supplier_by_id(result.supplier_id)
            
            if supplier.get('data_sources') and isinstance(supplier['data_sources'], str):
                data_sources = json.loads(supplier['data_sources'])
            else:
                data_sources = supplier.get('data_sources', {})
            
            # Determine the data source type
            source_type = None
            config = None
            
            if data_sources.get('ftp'):
                source_type = 'ftp'
                config = data_sources['ftp']
            elif data_sources.get('api'):
                source_type = 'api'
                config = data_sources['api']
            elif data_sources.get('file_upload'):
                source_type = 'file_upload'
                config = data_sources['file_upload']
                
                # Look for the uploaded file
                if result.file_path:
                    uploaded_file_path = result.file_path
                else:
                    # Look for any existing file for this supplier
                    supplier_files = [
                        f for f in os.listdir(UPLOAD_DIR) 
                        if f.startswith(f"{result.supplier_id}_") and 
                        f.split('.')[-1].lower() in config.get('allowed_extensions', ['csv', 'xlsx', 'xls'])
                    ]
                    
                    if not supplier_files:
                        result.add_error("test_pull", "No uploaded files found for this supplier")
                        return result
                    
                    # Sort by modification time (most recent first)
                    supplier_files.sort(
                        key=lambda f: os.path.getmtime(os.path.join(UPLOAD_DIR, f)),
                        reverse=True
                    )
                    
                    uploaded_file_path = os.path.join(UPLOAD_DIR, supplier_files[0])
                
                # Add the file path to the config
                config['uploaded_file_path'] = uploaded_file_path
                
            elif data_sources.get('edi'):
                source_type = 'edi'
                config = data_sources['edi']
                
            if not source_type or not config:
                result.add_error("test_pull", "No data source configured for this supplier")
                return result
            
            # Create appropriate connector
            connector = create_connector(source_type, config)
            
            # Test connection
            connection_test = connector.test_connection()
            if not connection_test.get('success', False):
                result.add_error("test_pull", 
                                connection_test.get('message', 'Connection failed'),
                                connection_test.get('details', {}))
                return result
            
            # Set up test pull filters (limit to 100 records)
            filters = TestPullFilter(limit=100)
            
            # Pull sample data
            pull_result = connector.pull_sample_data(limit=filters.limit)
            
            if not pull_result.get('success', False):
                result.add_error("test_pull", 
                                pull_result.get('message', 'Failed to pull data'),
                                pull_result.get('details', {}))
                return result
                
            sample_data = pull_result.get('sample_data', [])
            result.test_pull_success = True
            result.test_pull_data = sample_data
            result.steps_completed += 1
            
        except Exception as e:
            result.add_error("test_pull", f"Error during test pull: {str(e)}")
            # Continue with onboarding even if test pull fails
        
        # Step 4: Schema validation and mapping suggestion
        if result.test_pull_data:
            try:
                # Validate schema
                validation_results = validate_schema(result.test_pull_data)
                result.schema_validation = [r.dict() for r in validation_results]
                
                # Suggest mapping if we have test data
                mapping_templates = SupplierRepository.get_mapping_templates_by_source_type(source_type)
                suggestion, confidence = suggest_mapping(result.test_pull_data, mapping_templates)
                
                result.mapping_suggestion = suggestion
                result.mapping_confidence = confidence
                
                # If we have a good mapping suggestion (>70% confidence), update the supplier
                if confidence > 0.7 and suggestion and 'template_id' in suggestion:
                    # Update supplier with suggested mapping template
                    if data_sources and isinstance(data_sources, dict):
                        data_sources['mapping_template_id'] = suggestion['template_id']
                        update_data = {'data_sources': data_sources}
                        SupplierRepository.update_supplier(result.supplier_id, update_data)
                
                result.steps_completed += 1
                
            except Exception as e:
                result.add_error("schema_validation", f"Error during schema validation: {str(e)}")
                # Continue with onboarding even if validation fails
        else:
            # Skip validation step if no test data
            result.steps_completed += 1
            
        # Log the onboarding process
        log_data = {
            "supplier_id": result.supplier_id,
            "success": result.test_pull_success,
            "message": "Automated onboarding completed" if result.steps_completed == result.total_steps 
                      else "Partial onboarding completed",
            "sample_data": result.test_pull_data,
            "schema_validation": result.schema_validation,
            "mapping_suggestion": result.mapping_suggestion,
            "mapping_confidence": result.mapping_confidence,
            "timestamp": datetime.now()
        }
        SupplierRepository.log_test_pull(log_data)
        
    except Exception as e:
        logger.error(f"Unexpected error during onboarding: {str(e)}")
        result.add_error("onboarding", f"Unexpected error: {str(e)}")
        
    return result