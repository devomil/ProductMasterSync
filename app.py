import os
import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from models import (
    Supplier, SupplierCreate, SupplierUpdate, TestPullResult, 
    ErrorResponse, DataSourceConfig
)
from database import SupplierRepository
from connectors import create_connector

# Create FastAPI app
app = FastAPI(
    title="Supplier Management API",
    description="API for managing suppliers and their data sources in the MDM/PIM system",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define upload directory for file uploads
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# Exception handlers
@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    return ErrorResponse(
        status="error",
        message="An unexpected error occurred",
        details={"error": str(exc)}
    ).dict()


@app.exception_handler(ValidationError)
async def validation_exception_handler(request, exc):
    return ErrorResponse(
        status="error",
        message="Validation error",
        details={"errors": exc.errors()}
    ).dict()


# Supplier endpoints
@app.get("/suppliers", response_model=List[Supplier], tags=["Suppliers"])
async def get_suppliers():
    """Get all suppliers"""
    try:
        suppliers = SupplierRepository.get_all_suppliers()
        
        # Parse JSON fields
        for supplier in suppliers:
            if supplier.get('address') and isinstance(supplier['address'], str):
                supplier['address'] = json.loads(supplier['address'])
                
            if supplier.get('data_sources') and isinstance(supplier['data_sources'], str):
                supplier['data_sources'] = json.loads(supplier['data_sources'])
        
        return suppliers
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve suppliers: {str(e)}"
        )


@app.get("/suppliers/{supplier_id}", response_model=Supplier, tags=["Suppliers"])
async def get_supplier(supplier_id: str):
    """Get a supplier by ID"""
    try:
        supplier = SupplierRepository.get_supplier_by_id(supplier_id)
        
        if not supplier:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Supplier with ID {supplier_id} not found"
            )
        
        # Parse JSON fields
        if supplier.get('address') and isinstance(supplier['address'], str):
            supplier['address'] = json.loads(supplier['address'])
            
        if supplier.get('data_sources') and isinstance(supplier['data_sources'], str):
            supplier['data_sources'] = json.loads(supplier['data_sources'])
        
        return supplier
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve supplier: {str(e)}"
        )


@app.post("/suppliers", response_model=Supplier, tags=["Suppliers"])
async def create_supplier(supplier: SupplierCreate):
    """Create a new supplier"""
    try:
        # Convert Pydantic model to dict
        supplier_data = supplier.dict()
        
        # Generate an ID and timestamps
        supplier_data['id'] = str(uuid.uuid4())
        supplier_data['created_at'] = datetime.now()
        supplier_data['updated_at'] = datetime.now()
        
        # Create the supplier in the database
        created_supplier = SupplierRepository.create_supplier(supplier_data)
        
        # Parse JSON fields
        if created_supplier.get('address') and isinstance(created_supplier['address'], str):
            created_supplier['address'] = json.loads(created_supplier['address'])
            
        if created_supplier.get('data_sources') and isinstance(created_supplier['data_sources'], str):
            created_supplier['data_sources'] = json.loads(created_supplier['data_sources'])
        
        return created_supplier
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create supplier: {str(e)}"
        )


@app.put("/suppliers/{supplier_id}", response_model=Supplier, tags=["Suppliers"])
async def update_supplier(supplier_id: str, supplier_update: SupplierUpdate):
    """Update a supplier"""
    try:
        # Check if the supplier exists
        existing_supplier = SupplierRepository.get_supplier_by_id(supplier_id)
        
        if not existing_supplier:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Supplier with ID {supplier_id} not found"
            )
        
        # Convert Pydantic model to dict, excluding None values
        update_data = {k: v for k, v in supplier_update.dict().items() if v is not None}
        
        # Update the supplier
        updated_supplier = SupplierRepository.update_supplier(supplier_id, update_data)
        
        # Parse JSON fields
        if updated_supplier.get('address') and isinstance(updated_supplier['address'], str):
            updated_supplier['address'] = json.loads(updated_supplier['address'])
            
        if updated_supplier.get('data_sources') and isinstance(updated_supplier['data_sources'], str):
            updated_supplier['data_sources'] = json.loads(updated_supplier['data_sources'])
        
        return updated_supplier
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update supplier: {str(e)}"
        )


@app.delete("/suppliers/{supplier_id}", response_model=Dict[str, Any], tags=["Suppliers"])
async def delete_supplier(supplier_id: str):
    """Delete a supplier"""
    try:
        # Check if the supplier exists
        existing_supplier = SupplierRepository.get_supplier_by_id(supplier_id)
        
        if not existing_supplier:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Supplier with ID {supplier_id} not found"
            )
        
        # Delete the supplier
        deleted = SupplierRepository.delete_supplier(supplier_id)
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete supplier"
            )
        
        return {
            "status": "success",
            "message": f"Supplier with ID {supplier_id} has been deleted",
            "supplier_id": supplier_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete supplier: {str(e)}"
        )


@app.post("/suppliers/{supplier_id}/upload", response_model=Dict[str, Any], tags=["Data Sources"])
async def upload_supplier_file(
    supplier_id: str,
    file: UploadFile = File(...),
    config_json: str = Form(...),
):
    """Upload a file for a supplier's data source"""
    try:
        # Check if the supplier exists
        existing_supplier = SupplierRepository.get_supplier_by_id(supplier_id)
        
        if not existing_supplier:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Supplier with ID {supplier_id} not found"
            )
        
        # Parse the configuration
        try:
            config = json.loads(config_json)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON configuration"
            )
        
        # Validate file extension
        allowed_extensions = config.get('allowed_extensions', ['csv', 'xlsx', 'xls'])
        file_extension = file.filename.split('.')[-1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension .{file_extension} is not allowed. Allowed extensions: {', '.join(allowed_extensions)}"
            )
        
        # Save the file
        file_path = os.path.join(UPLOAD_DIR, f"{supplier_id}_{file.filename}")
        
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # Update the supplier's data_sources configuration
        if existing_supplier.get('data_sources') and isinstance(existing_supplier['data_sources'], str):
            data_sources = json.loads(existing_supplier['data_sources'])
        else:
            data_sources = {}
            
        # If data_sources is null or not a dict, initialize it
        if not data_sources or not isinstance(data_sources, dict):
            data_sources = {}
        
        # Update the file_upload configuration
        data_sources['file_upload'] = config
        
        # Update the supplier
        update_data = {'data_sources': data_sources}
        SupplierRepository.update_supplier(supplier_id, update_data)
        
        return {
            "status": "success",
            "message": f"File {file.filename} uploaded successfully",
            "file_path": file_path,
            "supplier_id": supplier_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )


@app.post("/suppliers/{supplier_id}/test-pull", tags=["Data Sources"])
async def test_pull(supplier_id: str, filters: TestPullFilter = None):
    """Test pull data from a supplier's data source"""
    try:
        # Check if the supplier exists
        existing_supplier = SupplierRepository.get_supplier_by_id(supplier_id)
        
        if not existing_supplier:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Supplier with ID {supplier_id} not found"
            )
        
        # Parse data_sources if it's a string
        if existing_supplier.get('data_sources') and isinstance(existing_supplier['data_sources'], str):
            data_sources = json.loads(existing_supplier['data_sources'])
        else:
            data_sources = existing_supplier.get('data_sources', {})
        
        # Validate that the supplier has at least one data source
        if not data_sources:
            result = TestPullResult(
                success=False,
                message="No data sources configured for this supplier",
                error_details={"supplier_id": supplier_id}
            )
            
            # Log the test pull attempt
            SupplierRepository.log_test_pull({
                "supplier_id": supplier_id,
                "success": False,
                "message": "No data sources configured for this supplier",
                "error_details": {"supplier_id": supplier_id},
                "timestamp": datetime.now()
            })
            
            return result
        
        # Determine which data source to use
        # Priority: FTP > API > File Upload
        connector = None
        data_source_type = None
        config = None
        
        if data_sources.get('ftp'):
            data_source_type = 'ftp'
            config = data_sources['ftp']
            connector = create_connector(data_source_type, config)
            
        elif data_sources.get('api'):
            data_source_type = 'api'
            config = data_sources['api']
            connector = create_connector(data_source_type, config)
            
        elif data_sources.get('file_upload'):
            data_source_type = 'file_upload'
            config = data_sources['file_upload']
            
            # Look for the most recent uploaded file for this supplier
            supplier_files = [
                f for f in os.listdir(UPLOAD_DIR) 
                if f.startswith(f"{supplier_id}_") and 
                f.split('.')[-1].lower() in config.get('allowed_extensions', ['csv', 'xlsx', 'xls'])
            ]
            
            if not supplier_files:
                result = TestPullResult(
                    success=False,
                    message="No uploaded files found for this supplier",
                    error_details={"supplier_id": supplier_id}
                )
                
                # Log the test pull attempt
                SupplierRepository.log_test_pull({
                    "supplier_id": supplier_id,
                    "success": False,
                    "message": "No uploaded files found for this supplier",
                    "error_details": {"supplier_id": supplier_id},
                    "timestamp": datetime.now()
                })
                
                return result
            
            # Sort by modification time (most recent first)
            supplier_files.sort(
                key=lambda f: os.path.getmtime(os.path.join(UPLOAD_DIR, f)),
                reverse=True
            )
            
            # Use the most recent file
            uploaded_file_path = os.path.join(UPLOAD_DIR, supplier_files[0])
            connector = create_connector(
                data_source_type, 
                config, 
                uploaded_file_path=uploaded_file_path
            )
        
        if not connector:
            result = TestPullResult(
                success=False,
                message="No supported data source found for this supplier",
                error_details={"supplier_id": supplier_id, "data_sources": data_sources}
            )
            
            # Log the test pull attempt
            SupplierRepository.log_test_pull({
                "supplier_id": supplier_id,
                "success": False,
                "message": "No supported data source found for this supplier",
                "error_details": {"supplier_id": supplier_id, "data_sources": data_sources},
                "timestamp": datetime.now()
            })
            
            return result
        
        # Test the connection first
        connection_test = connector.test_connection()
        
        if not connection_test['success']:
            result = TestPullResult(
                success=False,
                message=f"Connection test failed: {connection_test['message']}",
                error_details=connection_test.get('error_details', {})
            )
            
            # Log the test pull attempt
            SupplierRepository.log_test_pull({
                "supplier_id": supplier_id,
                "success": False,
                "message": f"Connection test failed: {connection_test['message']}",
                "error_details": connection_test.get('error_details', {}),
                "timestamp": datetime.now()
            })
            
            return result
        
        # If no filters provided, create default
        if filters is None:
            filters = TestPullFilter(limit=100)
            
        # Pull sample data
        pull_result = connector.pull_sample_data(limit=filters.limit)
        sample_data = pull_result.get('sample_data', [])
        
        # Apply filters if there is data
        if sample_data and pull_result.get('success', False):
            from mdm_supplier.mapping import apply_filters
            filter_dict = filters.dict(exclude_unset=True)
            sample_data = apply_filters(sample_data, filter_dict)
        
        # Perform schema validation
        schema_validation_results = None
        if sample_data and pull_result.get('success', False):
            from mdm_supplier.mapping import validate_schema
            
            # Get expected schema from data source config or use default
            expected_schema = None
            mapping_template_id = data_sources.get('mapping_template_id')
            if mapping_template_id:
                mapping_template = SupplierRepository.get_mapping_template_by_id(mapping_template_id)
                if mapping_template and 'expected_schema' in mapping_template:
                    expected_schema = mapping_template.get('expected_schema')
            
            # Validate schema
            schema_validation_results = validate_schema(sample_data, expected_schema)
        
        # Suggest mapping template if no mapping is already assigned
        mapping_suggestion = None
        mapping_confidence = 0.0
        if sample_data and pull_result.get('success', False) and not data_sources.get('mapping_template_id'):
            from mdm_supplier.mapping import suggest_mapping
            
            # Get templates for this source type
            mapping_templates = SupplierRepository.get_mapping_templates_by_source_type(data_source_type)
            
            # Suggest mapping
            mapping_suggestion, mapping_confidence = suggest_mapping(sample_data, mapping_templates)
        
        # Prepare TestPullResult
        result = TestPullResult(
            success=pull_result.get('success', False),
            message=pull_result.get('message', 'Unknown result'),
            sample_data=sample_data,
            error_details=pull_result.get('error_details', {}) if not pull_result.get('success', False) else None,
            schema_validation=schema_validation_results,
            mapping_suggestion=mapping_suggestion,
            mapping_confidence=mapping_confidence,
            timestamp=datetime.now()
        )
        
        # Log the test pull attempt
        log_data = {
            "supplier_id": supplier_id,
            "success": result.success,
            "message": result.message,
            "sample_data": result.sample_data,
            "error_details": result.error_details,
            "schema_validation": result.schema_validation,
            "mapping_suggestion": result.mapping_suggestion,
            "mapping_confidence": result.mapping_confidence,
            "timestamp": datetime.now()
        }
        SupplierRepository.log_test_pull(log_data)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        result = TestPullResult(
            success=False,
            message=f"Error during test pull: {str(e)}",
            error_details={"error_type": type(e).__name__, "error_message": str(e)}
        )
        
        # Log the test pull attempt
        SupplierRepository.log_test_pull({
            "supplier_id": supplier_id,
            "success": False,
            "message": f"Error during test pull: {str(e)}",
            "error_details": {"error_type": type(e).__name__, "error_message": str(e)},
            "timestamp": datetime.now()
        })
        
        return result


# Root endpoint for health check
@app.get("/", tags=["Health"])
async def root():
    """API health check"""
    return {
        "status": "ok",
        "message": "Supplier Management API is running",
        "version": "1.0.0"
    }


# Run the application with uvicorn when executed directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)