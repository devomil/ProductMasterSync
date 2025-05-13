import os
import json
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
from contextlib import contextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get database connection string from environment variable
DATABASE_URL = os.environ.get("DATABASE_URL")

def get_connection():
    """Create and return a new database connection"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise


@contextmanager
def get_db_cursor():
    """Context manager for database cursor"""
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        yield cursor
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def init_db():
    """Initialize database tables if they don't exist"""
    create_tables_query = """
    CREATE TABLE IF NOT EXISTS suppliers (
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
    
    CREATE TABLE IF NOT EXISTS mapping_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        source_type TEXT NOT NULL,
        field_mappings JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS test_pull_logs (
        id SERIAL PRIMARY KEY,
        supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        success BOOLEAN NOT NULL,
        message TEXT NOT NULL,
        sample_data JSONB,
        error_details JSONB,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );
    """
    
    try:
        with get_db_cursor() as cursor:
            cursor.execute(create_tables_query)
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database tables: {e}")
        raise


class SupplierRepository:
    """Repository for supplier-related database operations"""
    
    @staticmethod
    def create_supplier(supplier_data):
        """Create a new supplier in the database"""
        query = """
        INSERT INTO suppliers (
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
        query = "SELECT * FROM suppliers ORDER BY created_at DESC;"
        
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
        query = "SELECT * FROM suppliers WHERE id = %s;"
        
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
        UPDATE suppliers 
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
        query = "DELETE FROM suppliers WHERE id = %s RETURNING id;"
        
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
        INSERT INTO test_pull_logs (
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


# Initialize the database tables when the module is imported
init_db()