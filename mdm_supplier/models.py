"""
Data models for the supplier management module
"""
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, EmailStr, HttpUrl
from enum import Enum
from datetime import datetime
import uuid


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


class SuccessResponse(BaseModel):
    """Success response model"""
    status: str = "success"
    message: str
    data: Any = None