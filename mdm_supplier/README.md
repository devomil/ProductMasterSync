# MDM Supplier Management Module

This module provides a comprehensive supplier management system for the Master Data Management (MDM) / Product Information Management (PIM) platform.

## Features

- **Supplier CRUD Operations:** Create, read, update, and delete supplier information
- **Rich Supplier Model:** Includes contact information, addresses, and onboarding status
- **Data Source Configuration:**
  - EDI (Electronic Data Interchange)
  - FTP/SFTP file transfers
  - API integrations
  - File uploads (CSV, Excel)
- **Test Pull Functionality:** Verify supplier data sources with sample data pulls
- **Audit Logging:** Track data source testing and changes

## Installation

This module requires Python 3.8+ and the following dependencies:
- FastAPI
- Pydantic
- psycopg2-binary
- pandas
- requests
- uvicorn

For SFTP support, install:
- paramiko
- pysftp

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/suppliers` | List all suppliers |
| GET | `/suppliers/{supplier_id}` | Get supplier details |
| POST | `/suppliers` | Create a new supplier |
| PUT | `/suppliers/{supplier_id}` | Update a supplier |
| DELETE | `/suppliers/{supplier_id}` | Delete a supplier |
| POST | `/suppliers/{supplier_id}/upload` | Upload a file for a supplier |
| POST | `/suppliers/{supplier_id}/test-pull` | Test data pull from supplier source |
| GET | `/suppliers/{supplier_id}/test-pull-logs` | Get logs of test pulls |

## Usage Examples

### Creating a Supplier

```python
supplier_data = {
    "name": "Acme Supplies",
    "contact_email": "vendor@acme.com",
    "contact_name": "John Smith",
    "contact_phone": "555-123-4567",
    "data_sources": {
        "ftp": {
            "host": "ftp.acme.com",
            "username": "user",
            "password": "pass",
            "path": "/products/"
        }
    }
}
```

### Testing a Data Pull

```python
test_pull_result = await test_pull("supplier_id_123", limit=50)
if test_pull_result.success:
    products = test_pull_result.sample_data
    # Process products
else:
    error_details = test_pull_result.error_details
    # Handle error
```

## Database Schema

The module uses two primary tables:

1. `mdm_suppliers`: Stores supplier information and data source configurations
2. `mdm_supplier_test_pulls`: Logs test pull attempts and results

## Implementation Notes

- The module is designed to be used as a standalone microservice or integrated into a larger MDM/PIM system
- All database operations use parameterized queries to prevent SQL injection
- Passwords and secret tokens are excluded from JSON serialization for security
- The module follows RESTful API design principles