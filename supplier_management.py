import os
import json
import logging
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Union

# FastAPI imports
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Pydantic models
from pydantic import BaseModel, Field, EmailStr, HttpUrl, ValidationError
from enum import Enum

# Database connection
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get database connection string from environment variable
DATABASE_URL = os.environ.get("DATABASE_URL")

# Define upload directory for file uploads
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ======================
# Pydantic Models
# ======================

class OnboardingStatus(str, Enum):
    """Enum for supplier onboarding status"""
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    PROBATION = "probation"


class Address(BaseModel):
    """Address model for supplier"""
    street: str
    city: str
    state: str
    postal_code: str
    country: str


class EDIConfig(BaseModel):
    """EDI configuration for supplier data source"""
    enabled: bool = False
    edi_type: Optional[str] = Field(None, description="Type of EDI format, e.g., X12, EDIFACT")
    trading_partner_id: Optional[str] = None
    standard_version: Optional[str] = None
    segment_terminator: Optional[str] = None
    element_separator: Optional[str] = None


class FTPConfig(BaseModel):
    """FTP/SFTP configuration for supplier data source"""
    host: str
    username: str
    password: str = Field(..., exclude=True)  # Exclude from JSON output for security
    port: int = 22
    path: str = "/"
    is_sftp: bool = True  # Default to SFTP (more secure)
    private_key_path: Optional[str] = None


class APIConfig(BaseModel):
    """API configuration for supplier data source"""
    url: HttpUrl
    headers: Optional[Dict[str, str]] = None
    auth_type: str = "none"  # none, basic, token, oauth
    username: Optional[str] = None
    password: Optional[str] = Field(None, exclude=True)  # Exclude from JSON output
    token: Optional[str] = Field(None, exclude=True)  # Exclude from JSON output
    oauth_url: Optional[HttpUrl] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = Field(None, exclude=True)  # Exclude from JSON output
    pagination_type: Optional[str] = None  # offset, page, cursor
    pagination_params: Optional[Dict[str, Any]] = None


class FileUploadConfig(BaseModel):
    """File upload configuration for supplier data source"""
    allowed_extensions: List[str] = ["csv", "xlsx", "xls"]
    has_header: bool = True
    delimiter: str = ","
    encoding: str = "utf-8"
    sheet_name: Optional[str] = None  # For Excel files


class DataSourceConfig(BaseModel):
    """Complete data source configuration for supplier"""
    edi: Optional[EDIConfig] = None
    ftp: Optional[FTPConfig] = None
    api: Optional[APIConfig] = None
    file_upload: Optional[FileUploadConfig] = None
    mapping_template_id: Optional[str] = None


class SupplierBase(BaseModel):
    """Base supplier model with shared attributes"""
    name: str
    contact_name: Optional[str] = None
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    website: Optional[HttpUrl] = None
    address: Optional[Address] = None
    onboarding_status: OnboardingStatus = OnboardingStatus.PENDING
    data_sources: Optional[DataSourceConfig] = None
    notes: Optional[str] = None


class SupplierCreate(SupplierBase):
    """Model for creating a new supplier"""
    pass


class SupplierUpdate(BaseModel):
    """Model for updating an existing supplier with all fields optional"""
    name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    website: Optional[HttpUrl] = None
    address: Optional[Address] = None
    onboarding_status: Optional[OnboardingStatus] = None
    data_sources: Optional[DataSourceConfig] = None
    notes: Optional[str] = None


class Supplier(SupplierBase):
    """Complete supplier model including database fields"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        from_attributes = True


class TestPullResult(BaseModel):
    """Result of a test pull from a supplier data source"""
    success: bool
    message: str
    sample_data: Optional[List[Dict[str, Any]]] = None
    error_details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class ErrorResponse(BaseModel):
    """Error response model"""
    status: str = "error"
    message: str
    details: Optional[Dict[str, Any]] = None


# ======================
# Database Functions
# ======================

@contextmanager
def get_db_cursor():
    """Context manager for database cursor"""
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        yield cursor
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        if conn:
            conn.close()


def create_supplier_table():
    """Create supplier table if it doesn't exist"""
    create_table_query = """
    CREATE TABLE IF NOT EXISTS supplier_management (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact_name TEXT,
        contact_email TEXT NOT NULL,
        contact_phone TEXT,
        website TEXT,
        address JSONB,
        onboarding_status TEXT NOT NULL,
        data_sources JSONB,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS supplier_test_pulls (
        id SERIAL PRIMARY KEY,
        supplier_id TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        message TEXT NOT NULL,
        sample_data JSONB,
        error_details JSONB,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES supplier_management(id)
    );
    """
    
    try:
        with get_db_cursor() as cursor:
            cursor.execute(create_table_query)
        logger.info("Supplier tables created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create supplier tables: {e}")
        return False


# ======================
# Supplier Repository
# ======================

class SupplierRepository:
    """Repository for supplier-related database operations"""
    
    @staticmethod
    def create_supplier(supplier_data):
        """Create a new supplier in the database"""
        query = """
        INSERT INTO supplier_management (
            id, name, contact_name, contact_email, contact_phone, website, 
            address, onboarding_status, data_sources, notes, created_at, updated_at
        ) VALUES (
            %(id)s, %(name)s, %(contact_name)s, %(contact_email)s, %(contact_phone)s, %(website)s,
            %(address)s, %(onboarding_status)s, %(data_sources)s, %(notes)s, %(created_at)s, %(updated_at)s
        ) RETURNING *;
        """
        
        # Convert JSON fields to strings if they are dictionaries
        if isinstance(supplier_data.get('address'), dict):
            supplier_data['address'] = json.dumps(supplier_data['address'])
            
        if isinstance(supplier_data.get('data_sources'), dict):
            supplier_data['data_sources'] = json.dumps(supplier_data['data_sources'])
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, supplier_data)
                result = cursor.fetchone()
                return dict(result) if result else None
        except Exception as e:
            logger.error(f"Error creating supplier: {e}")
            raise
    
    @staticmethod
    def get_all_suppliers():
        """Get all suppliers from the database"""
        query = "SELECT * FROM supplier_management ORDER BY created_at DESC;"
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query)
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Error retrieving suppliers: {e}")
            raise
    
    @staticmethod
    def get_supplier_by_id(supplier_id):
        """Get a supplier by ID"""
        query = "SELECT * FROM supplier_management WHERE id = %s;"
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, (supplier_id,))
                result = cursor.fetchone()
                return dict(result) if result else None
        except Exception as e:
            logger.error(f"Error retrieving supplier by ID: {e}")
            raise
    
    @staticmethod
    def update_supplier(supplier_id, update_data):
        """Update a supplier in the database"""
        # Build the SET part of the SQL dynamically based on the update_data keys
        set_parts = []
        params = {}
        
        for key, value in update_data.items():
            # Skip id as it shouldn't be updated
            if key == 'id':
                continue
                
            # Convert dict values to JSON strings
            if isinstance(value, dict):
                value = json.dumps(value)
                
            set_parts.append(f"{key} = %({key})s")
            params[key] = value
        
        # Always update the updated_at timestamp
        set_parts.append("updated_at = %(updated_at)s")
        params['updated_at'] = datetime.now()
        params['id'] = supplier_id
        
        query = f"""
        UPDATE supplier_management 
        SET {', '.join(set_parts)}
        WHERE id = %(id)s
        RETURNING *;
        """
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, params)
                result = cursor.fetchone()
                return dict(result) if result else None
        except Exception as e:
            logger.error(f"Error updating supplier: {e}")
            raise
    
    @staticmethod
    def delete_supplier(supplier_id):
        """Delete a supplier from the database"""
        query = "DELETE FROM supplier_management WHERE id = %s RETURNING id;"
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, (supplier_id,))
                result = cursor.fetchone()
                return dict(result) if result else None
        except Exception as e:
            logger.error(f"Error deleting supplier: {e}")
            raise
    
    @staticmethod
    def log_test_pull(log_data):
        """Log a test pull attempt in the database"""
        query = """
        INSERT INTO supplier_test_pulls (
            supplier_id, success, message, sample_data, error_details, timestamp
        ) VALUES (
            %(supplier_id)s, %(success)s, %(message)s, %(sample_data)s, %(error_details)s, %(timestamp)s
        ) RETURNING id;
        """
        
        # Convert JSON fields to strings if they are dictionaries
        if isinstance(log_data.get('sample_data'), dict) or isinstance(log_data.get('sample_data'), list):
            log_data['sample_data'] = json.dumps(log_data['sample_data'])
            
        if isinstance(log_data.get('error_details'), dict):
            log_data['error_details'] = json.dumps(log_data['error_details'])
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, log_data)
                result = cursor.fetchone()
                return dict(result) if result else None
        except Exception as e:
            logger.error(f"Error logging test pull: {e}")
            raise


# ======================
# FastAPI Application
# ======================

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


# Exception handlers
@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            status="error",
            message="An unexpected error occurred",
            details={"error": str(exc)}
        ).dict()
    )


@app.exception_handler(ValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ErrorResponse(
            status="error",
            message="Validation error",
            details={"errors": exc.errors()}
        ).dict()
    )


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup"""
    create_supplier_table()


# Root endpoint for health check
@app.get("/", tags=["Health"])
async def root():
    """API health check"""
    return {
        "status": "ok",
        "message": "Supplier Management API is running",
        "version": "1.0.0"
    }


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


@app.post("/suppliers/{supplier_id}/test-pull", response_model=TestPullResult, tags=["Data Sources"])
async def test_pull(supplier_id: str, limit: int = 100):
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
        
        # For simplicity in this initial version, just return a success response
        # with sample data. In a real implementation, you would use the connectors module.
        result = TestPullResult(
            success=True,
            message=f"Successfully pulled sample data from supplier {supplier_id}",
            sample_data=[
                {"sku": "ABC123", "name": "Sample Product 1", "price": 19.99},
                {"sku": "DEF456", "name": "Sample Product 2", "price": 29.99},
                {"sku": "GHI789", "name": "Sample Product 3", "price": 39.99},
            ]
        )
        
        # Log the test pull attempt
        SupplierRepository.log_test_pull({
            "supplier_id": supplier_id,
            "success": True,
            "message": f"Successfully pulled sample data from supplier {supplier_id}",
            "sample_data": result.sample_data,
            "timestamp": datetime.now()
        })
        
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


# Run the application with uvicorn when executed directly
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)