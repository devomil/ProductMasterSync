"""
PostgreSQL database operations module for supplier management
"""
import os
import json
import logging
import psycopg2
import psycopg2.extras
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from contextlib import contextmanager
from typing import Dict, List, Any, Optional
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get database connection string from environment variable
DATABASE_URL = os.environ.get('DATABASE_URL')

def get_connection():
    """Create and return a new database connection"""
    if not DATABASE_URL:
        raise Exception("DATABASE_URL environment variable is not set")
    
    return psycopg2.connect(DATABASE_URL)


@contextmanager
def get_db_cursor():
    """Context manager for database cursor"""
    conn = None
    try:
        conn = get_connection()
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        yield cursor
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()


def init_db():
    """Initialize database tables if they don't exist"""
    with get_db_cursor() as cursor:
        # Create suppliers table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS suppliers (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            contact_name VARCHAR(255),
            contact_email VARCHAR(255) NOT NULL,
            contact_phone VARCHAR(50),
            website VARCHAR(255),
            address JSONB,
            onboarding_status VARCHAR(20) NOT NULL DEFAULT 'pending',
            data_sources JSONB,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            -- Add indexes for better performance
            INDEX idx_suppliers_name (name),
            INDEX idx_suppliers_contact_email (contact_email),
            INDEX idx_suppliers_onboarding_status (onboarding_status),
            INDEX idx_suppliers_created_at (created_at)
        );
        """)
        
        # Create test_pull_logs table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS test_pull_logs (
            id SERIAL PRIMARY KEY,
            supplier_id VARCHAR(36) NOT NULL,
            success BOOLEAN NOT NULL,
            message TEXT NOT NULL,
            sample_data JSONB,
            error_details JSONB,
            schema_validation JSONB,
            mapping_suggestion JSONB,
            mapping_confidence FLOAT,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            -- Add indexes
            INDEX idx_test_pull_logs_supplier_id (supplier_id),
            INDEX idx_test_pull_logs_success (success),
            INDEX idx_test_pull_logs_timestamp (timestamp),
            
            -- Add foreign key
            CONSTRAINT fk_test_pull_logs_supplier_id
                FOREIGN KEY (supplier_id)
                REFERENCES suppliers(id)
                ON DELETE CASCADE
        );
        """)
        
        # Create mapping_templates table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS mapping_templates (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            source_type VARCHAR(50) NOT NULL,
            mappings JSONB NOT NULL,
            transformations JSONB,
            validation_rules JSONB,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            -- Add indexes
            INDEX idx_mapping_templates_name (name),
            INDEX idx_mapping_templates_source_type (source_type)
        );
        """)
        
        logger.info("Database initialized successfully")


class SupplierRepository:
    """Repository for supplier-related database operations"""
    
    @staticmethod
    def create_supplier(supplier_data):
        """Create a new supplier in the database"""
        with get_db_cursor() as cursor:
            # Convert address and data_sources to JSON if they exist
            address_json = json.dumps(supplier_data.get('address')) if supplier_data.get('address') else None
            data_sources_json = json.dumps(supplier_data.get('data_sources')) if supplier_data.get('data_sources') else None
            
            # Ensure timestamps are set
            supplier_data.setdefault('created_at', datetime.now())
            supplier_data.setdefault('updated_at', datetime.now())
            
            cursor.execute("""
            INSERT INTO suppliers (
                id, name, contact_name, contact_email, contact_phone, 
                website, address, onboarding_status, data_sources, notes,
                created_at, updated_at
            )
            VALUES (
                %s, %s, %s, %s, %s, 
                %s, %s, %s, %s, %s,
                %s, %s
            )
            RETURNING *;
            """, (
                supplier_data.get('id'),
                supplier_data.get('name'),
                supplier_data.get('contact_name'),
                supplier_data.get('contact_email'),
                supplier_data.get('contact_phone'),
                supplier_data.get('website'),
                address_json,
                supplier_data.get('onboarding_status', 'pending'),
                data_sources_json,
                supplier_data.get('notes'),
                supplier_data.get('created_at'),
                supplier_data.get('updated_at')
            ))
            
            result = cursor.fetchone()
            if result:
                # Convert to dictionary and parse JSON fields
                supplier_dict = dict(result)
                
                # Deserialize JSON fields
                if supplier_dict.get('address') and isinstance(supplier_dict['address'], str):
                    try:
                        supplier_dict['address'] = json.loads(supplier_dict['address'])
                    except json.JSONDecodeError:
                        pass
                
                if supplier_dict.get('data_sources') and isinstance(supplier_dict['data_sources'], str):
                    try:
                        supplier_dict['data_sources'] = json.loads(supplier_dict['data_sources'])
                    except json.JSONDecodeError:
                        pass
                        
                return supplier_dict
            
            return None

    @staticmethod
    def get_all_suppliers():
        """Get all suppliers from the database"""
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM suppliers ORDER BY created_at DESC;")
            suppliers = cursor.fetchall()
            
            # Convert to list of dictionaries and parse JSON fields
            result = []
            for supplier in suppliers:
                supplier_dict = dict(supplier)
                
                # Deserialize JSON fields
                if supplier_dict.get('address') and isinstance(supplier_dict['address'], str):
                    try:
                        supplier_dict['address'] = json.loads(supplier_dict['address'])
                    except json.JSONDecodeError:
                        pass
                
                if supplier_dict.get('data_sources') and isinstance(supplier_dict['data_sources'], str):
                    try:
                        supplier_dict['data_sources'] = json.loads(supplier_dict['data_sources'])
                    except json.JSONDecodeError:
                        pass
                        
                result.append(supplier_dict)
                
            return result

    @staticmethod
    def get_supplier_by_id(supplier_id):
        """Get a supplier by ID"""
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM suppliers WHERE id = %s;", (supplier_id,))
            supplier = cursor.fetchone()
            
            if supplier:
                # Convert to dictionary and parse JSON fields
                supplier_dict = dict(supplier)
                
                # Deserialize JSON fields
                if supplier_dict.get('address') and isinstance(supplier_dict['address'], str):
                    try:
                        supplier_dict['address'] = json.loads(supplier_dict['address'])
                    except json.JSONDecodeError:
                        pass
                
                if supplier_dict.get('data_sources') and isinstance(supplier_dict['data_sources'], str):
                    try:
                        supplier_dict['data_sources'] = json.loads(supplier_dict['data_sources'])
                    except json.JSONDecodeError:
                        pass
                        
                return supplier_dict
                
            return None

    @staticmethod
    def update_supplier(supplier_id, update_data):
        """Update a supplier in the database"""
        with get_db_cursor() as cursor:
            # Get the existing supplier to merge data
            cursor.execute("SELECT * FROM suppliers WHERE id = %s;", (supplier_id,))
            existing = cursor.fetchone()
            
            if not existing:
                return None
            
            # Convert existing to dictionary
            existing_dict = dict(existing)
            
            # Handle JSON fields
            if update_data.get('address'):
                update_data['address'] = json.dumps(update_data['address'])
            
            if update_data.get('data_sources'):
                update_data['data_sources'] = json.dumps(update_data['data_sources'])
            
            # Always update the updated_at timestamp
            update_data['updated_at'] = datetime.now()
            
            # Build the SET clause dynamically based on what's being updated
            set_clause_parts = [f"{key} = %s" for key in update_data.keys()]
            set_clause = ", ".join(set_clause_parts)
            
            # Build the parameter list for the query
            params = list(update_data.values())
            params.append(supplier_id)  # For the WHERE clause
            
            # Execute the update
            cursor.execute(f"""
            UPDATE suppliers
            SET {set_clause}
            WHERE id = %s
            RETURNING *;
            """, params)
            
            updated = cursor.fetchone()
            if updated:
                # Convert to dictionary and parse JSON fields
                updated_dict = dict(updated)
                
                # Deserialize JSON fields
                if updated_dict.get('address') and isinstance(updated_dict['address'], str):
                    try:
                        updated_dict['address'] = json.loads(updated_dict['address'])
                    except json.JSONDecodeError:
                        pass
                
                if updated_dict.get('data_sources') and isinstance(updated_dict['data_sources'], str):
                    try:
                        updated_dict['data_sources'] = json.loads(updated_dict['data_sources'])
                    except json.JSONDecodeError:
                        pass
                        
                return updated_dict
                
            return None

    @staticmethod
    def delete_supplier(supplier_id):
        """Delete a supplier from the database"""
        with get_db_cursor() as cursor:
            cursor.execute("DELETE FROM suppliers WHERE id = %s RETURNING id;", (supplier_id,))
            deleted = cursor.fetchone()
            return deleted is not None

    @staticmethod
    def log_test_pull(log_data):
        """Log a test pull attempt in the database"""
        with get_db_cursor() as cursor:
            # Convert complex objects to JSON
            sample_data_json = json.dumps(log_data.get('sample_data')) if log_data.get('sample_data') else None
            error_details_json = json.dumps(log_data.get('error_details')) if log_data.get('error_details') else None
            schema_validation_json = json.dumps(log_data.get('schema_validation')) if log_data.get('schema_validation') else None
            mapping_suggestion_json = json.dumps(log_data.get('mapping_suggestion')) if log_data.get('mapping_suggestion') else None
            
            cursor.execute("""
            INSERT INTO test_pull_logs (
                supplier_id, success, message, sample_data, error_details,
                schema_validation, mapping_suggestion, mapping_confidence, timestamp
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            RETURNING id;
            """, (
                log_data.get('supplier_id'),
                log_data.get('success'),
                log_data.get('message'),
                sample_data_json,
                error_details_json,
                schema_validation_json,
                mapping_suggestion_json,
                log_data.get('mapping_confidence'),
                log_data.get('timestamp', datetime.now())
            ))
            
            result = cursor.fetchone()
            return result[0] if result else None

    @staticmethod
    def get_mapping_templates_by_source_type(source_type):
        """Get mapping templates by source type"""
        with get_db_cursor() as cursor:
            cursor.execute("""
            SELECT * FROM mapping_templates
            WHERE source_type = %s
            ORDER BY created_at DESC;
            """, (source_type,))
            
            templates = cursor.fetchall()
            
            # Convert to list of dictionaries and parse JSON fields
            result = []
            for template in templates:
                template_dict = dict(template)
                
                # Deserialize JSON fields
                for field in ['mappings', 'transformations', 'validation_rules']:
                    if template_dict.get(field) and isinstance(template_dict[field], str):
                        try:
                            template_dict[field] = json.loads(template_dict[field])
                        except json.JSONDecodeError:
                            pass
                
                result.append(template_dict)
                
            return result

    @staticmethod
    def create_mapping_template(template_data):
        """Create a new mapping template in the database"""
        with get_db_cursor() as cursor:
            # Convert complex objects to JSON
            mappings_json = json.dumps(template_data.get('mappings'))
            transformations_json = json.dumps(template_data.get('transformations')) if template_data.get('transformations') else None
            validation_rules_json = json.dumps(template_data.get('validation_rules')) if template_data.get('validation_rules') else None
            
            cursor.execute("""
            INSERT INTO mapping_templates (
                name, description, source_type, mappings,
                transformations, validation_rules, created_at, updated_at
            )
            VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            RETURNING id;
            """, (
                template_data.get('name'),
                template_data.get('description'),
                template_data.get('source_type'),
                mappings_json,
                transformations_json,
                validation_rules_json,
                datetime.now(),
                datetime.now()
            ))
            
            result = cursor.fetchone()
            return result[0] if result else None