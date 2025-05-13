"""
Run the Supplier Management API
"""
import uvicorn
from mdm_supplier.api import app

if __name__ == "__main__":
    """Run FastAPI with uvicorn server"""
    print("Starting Supplier Management API...")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)