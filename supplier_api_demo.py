#!/usr/bin/env python3
import json
import uuid
from datetime import datetime

def create_supplier(supplier_data):
    """Simulate creating a supplier and return a response"""
    # Generate supplier ID
    supplier_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    # Create response data
    response = {
        "id": supplier_id,
        "name": supplier_data.get("name"),
        "contact_name": supplier_data.get("contact_name"),
        "contact_email": supplier_data.get("contact_email"),
        "contact_phone": supplier_data.get("contact_phone"),
        "website": supplier_data.get("website"),
        "address": supplier_data.get("address"),
        "onboarding_status": supplier_data.get("onboarding_status", "pending"),
        "data_sources": supplier_data.get("data_sources"),
        "notes": supplier_data.get("notes"),
        "created_at": now,
        "updated_at": now
    }
    
    return {
        "status": "success",
        "message": "Supplier created successfully",
        "data": response
    }

def get_suppliers():
    """Simulate getting all suppliers"""
    suppliers = [
        {
            "id": "abc123",
            "name": "Acme Supplies",
            "contact_name": "John Smith",
            "contact_email": "vendor@acme.com",
            "contact_phone": "555-123-4567",
            "onboarding_status": "active",
            "data_sources": {
                "ftp": {
                    "host": "ftp.acme.com",
                    "username": "user",
                    "password": "[REDACTED]",
                    "path": "/products/"
                }
            },
            "created_at": "2025-05-01T10:00:00",
            "updated_at": "2025-05-01T10:00:00"
        },
        {
            "id": "def456",
            "name": "Global Manufacturing",
            "contact_name": "Jane Doe",
            "contact_email": "jane@globalmanufacturing.com",
            "contact_phone": "555-987-6543",
            "onboarding_status": "pending",
            "data_sources": {
                "api": {
                    "url": "https://api.globalmanufacturing.com/products",
                    "auth_type": "token",
                    "token": "[REDACTED]"
                }
            },
            "created_at": "2025-05-02T11:00:00",
            "updated_at": "2025-05-02T11:00:00"
        },
        {
            "id": "ghi789",
            "name": "Wholesale Distributors",
            "contact_name": "Bob Johnson",
            "contact_email": "bob@wholesale.com",
            "contact_phone": "555-111-2222",
            "onboarding_status": "active",
            "data_sources": {
                "file_upload": {
                    "allowed_extensions": ["csv", "xlsx"],
                    "has_header": True,
                    "delimiter": ","
                }
            },
            "created_at": "2025-05-03T12:00:00",
            "updated_at": "2025-05-03T12:00:00"
        }
    ]
    
    return {
        "status": "success",
        "message": "Suppliers retrieved successfully",
        "data": suppliers
    }

def get_supplier(supplier_id):
    """Simulate getting a supplier by ID"""
    # For demo purposes, we'll return a supplier
    if supplier_id not in ["abc123", "def456", "ghi789"]:
        return {
            "status": "error",
            "message": f"Supplier with ID {supplier_id} not found"
        }
    
    suppliers = get_suppliers()["data"]
    for supplier in suppliers:
        if supplier["id"] == supplier_id:
            return {
                "status": "success",
                "message": "Supplier retrieved successfully",
                "data": supplier
            }

def test_pull(supplier_id):
    """Simulate test pulling data from a supplier"""
    if supplier_id not in ["abc123", "def456", "ghi789"]:
        return {
            "status": "error",
            "message": f"Supplier with ID {supplier_id} not found"
        }
    
    # Sample data based on supplier ID
    sample_data = []
    
    if supplier_id == "abc123":  # Acme Supplies (FTP)
        sample_data = [
            {"sku": "ACME-001", "name": "Premium Widget", "price": 19.99, "quantity": 100},
            {"sku": "ACME-002", "name": "Deluxe Gadget", "price": 29.99, "quantity": 50},
            {"sku": "ACME-003", "name": "Super Tool", "price": 39.99, "quantity": 75}
        ]
    elif supplier_id == "def456":  # Global Manufacturing (API)
        sample_data = [
            {"product_id": "GM-P100", "product_name": "Industrial Valve", "unit_price": 129.50, "stock_level": 25},
            {"product_id": "GM-P101", "product_name": "Hydraulic Pump", "unit_price": 349.99, "stock_level": 10},
            {"product_id": "GM-P102", "product_name": "Control Panel", "unit_price": 499.99, "stock_level": 5}
        ]
    elif supplier_id == "ghi789":  # Wholesale Distributors (File Upload)
        sample_data = [
            {"item_code": "WD-50001", "description": "Office Chair", "wholesale_price": 89.99, "retail_price": 149.99, "available": 200},
            {"item_code": "WD-50002", "description": "Executive Desk", "wholesale_price": 299.99, "retail_price": 499.99, "available": 20},
            {"item_code": "WD-50003", "description": "Filing Cabinet", "wholesale_price": 149.99, "retail_price": 249.99, "available": 45}
        ]
    
    return {
        "status": "success",
        "message": f"Successfully pulled sample data from supplier {supplier_id}",
        "data": {
            "success": True,
            "message": f"Successfully pulled {len(sample_data)} records from supplier",
            "sample_data": sample_data,
            "timestamp": datetime.now().isoformat()
        }
    }

if __name__ == "__main__":
    # Demo usage
    print("=== Create Supplier Demo ===")
    supplier_data = {
        "name": "Demo Supplier",
        "contact_email": "contact@demosupplier.com",
        "data_sources": {
            "api": {
                "url": "https://api.demosupplier.com",
                "auth_type": "basic",
                "username": "apiuser",
                "password": "apipass"
            }
        }
    }
    print(json.dumps(create_supplier(supplier_data), indent=2))
    
    print("\n=== Get Suppliers Demo ===")
    print(json.dumps(get_suppliers(), indent=2))
    
    print("\n=== Get Supplier by ID Demo ===")
    print(json.dumps(get_supplier("abc123"), indent=2))
    
    print("\n=== Test Pull Demo ===")
    print(json.dumps(test_pull("abc123"), indent=2))