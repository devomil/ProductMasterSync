"""
Database connection and repository for supplier management
"""
import os
import json
import logging
from datetime import datetime
from contextlib import contextmanager
from typing import List, Dict, Any, Optional, Union

import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get database connection string from environment variable
DATABASE_URL = os.environ.get("DATABASE_URL")


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


def init_supplier_tables():
    """Create tables for supplier management if they don't exist"""
    create_tables_query = """
    CREATE TABLE IF NOT EXISTS mdm_suppliers (
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
    
    CREATE TABLE IF NOT EXISTS mdm_mapping_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        source_type TEXT NOT NULL,
        expected_schema JSONB,
        field_mappings JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS mdm_supplier_test_pulls (
        id SERIAL PRIMARY KEY,
        supplier_id TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        message TEXT NOT NULL,
        sample_data JSONB,
        error_details JSONB,
        schema_validation JSONB,
        mapping_suggestion JSONB,
        mapping_confidence FLOAT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES mdm_suppliers(id)
    );
    """
    
    try:
        with get_db_cursor() as cursor:
            cursor.execute(create_tables_query)
        logger.info("Supplier tables created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create supplier tables: {e}")
        return False


class SupplierRepository:
    """Repository for supplier-related database operations"""
    
    @staticmethod
    def create_supplier(supplier_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new supplier in the database"""
        query = """
        INSERT INTO mdm_suppliers (
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
    def get_all_suppliers() -> List[Dict[str, Any]]:
        """Get all suppliers from the database"""
        query = "SELECT * FROM mdm_suppliers ORDER BY created_at DESC;"
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query)
                suppliers = [dict(row) for row in cursor.fetchall()]
                
                # Parse JSON fields
                for supplier in suppliers:
                    if isinstance(supplier.get('address'), str):
                        try:
                            supplier['address'] = json.loads(supplier['address'])
                        except:
                            pass
                        
                    if isinstance(supplier.get('data_sources'), str):
                        try:
                            supplier['data_sources'] = json.loads(supplier['data_sources'])
                        except:
                            pass
                
                return suppliers
        except Exception as e:
            logger.error(f"Error retrieving suppliers: {e}")
            raise
    
    @staticmethod
    def get_supplier_by_id(supplier_id: str) -> Optional[Dict[str, Any]]:
        """Get a supplier by ID"""
        query = "SELECT * FROM mdm_suppliers WHERE id = %s;"
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, (supplier_id,))
                result = cursor.fetchone()
                
                if not result:
                    return None
                
                supplier = dict(result)
                
                # Parse JSON fields
                if isinstance(supplier.get('address'), str):
                    try:
                        supplier['address'] = json.loads(supplier['address'])
                    except:
                        pass
                    
                if isinstance(supplier.get('data_sources'), str):
                    try:
                        supplier['data_sources'] = json.loads(supplier['data_sources'])
                    except:
                        pass
                
                return supplier
        except Exception as e:
            logger.error(f"Error retrieving supplier by ID: {e}")
            raise
    
    @staticmethod
    def update_supplier(supplier_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
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
        UPDATE mdm_suppliers 
        SET {', '.join(set_parts)}
        WHERE id = %(id)s
        RETURNING *;
        """
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, params)
                result = cursor.fetchone()
                
                if not result:
                    return None
                
                supplier = dict(result)
                
                # Parse JSON fields
                if isinstance(supplier.get('address'), str):
                    try:
                        supplier['address'] = json.loads(supplier['address'])
                    except:
                        pass
                    
                if isinstance(supplier.get('data_sources'), str):
                    try:
                        supplier['data_sources'] = json.loads(supplier['data_sources'])
                    except:
                        pass
                
                return supplier
        except Exception as e:
            logger.error(f"Error updating supplier: {e}")
            raise
    
    @staticmethod
    def delete_supplier(supplier_id: str) -> bool:
        """Delete a supplier from the database"""
        # First delete any test pull logs for this supplier
        delete_logs_query = "DELETE FROM mdm_supplier_test_pulls WHERE supplier_id = %s;"
        
        # Then delete the supplier
        delete_supplier_query = "DELETE FROM mdm_suppliers WHERE id = %s RETURNING id;"
        
        try:
            with get_db_cursor() as cursor:
                # Delete test pull logs first to avoid foreign key constraint
                cursor.execute(delete_logs_query, (supplier_id,))
                
                # Delete the supplier
                cursor.execute(delete_supplier_query, (supplier_id,))
                result = cursor.fetchone()
                
                return result is not None
        except Exception as e:
            logger.error(f"Error deleting supplier: {e}")
            raise
    
    @staticmethod
    def create_mapping_template(template_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new mapping template in the database"""
        query = """
        INSERT INTO mdm_mapping_templates (
            id, name, description, source_type, expected_schema, field_mappings, created_at, updated_at
        ) VALUES (
            %(id)s, %(name)s, %(description)s, %(source_type)s, %(expected_schema)s, 
            %(field_mappings)s, %(created_at)s, %(updated_at)s
        ) RETURNING *;
        """
        
        # Generate ID if not provided
        if 'id' not in template_data:
            template_data['id'] = str(uuid.uuid4())
            
        # Add timestamps if not provided
        if 'created_at' not in template_data:
            template_data['created_at'] = datetime.now()
        if 'updated_at' not in template_data:
            template_data['updated_at'] = datetime.now()
        
        # Convert JSON fields to strings
        if isinstance(template_data.get('expected_schema'), dict):
            template_data['expected_schema'] = json.dumps(template_data['expected_schema'])
            
        if isinstance(template_data.get('field_mappings'), (dict, list)):
            template_data['field_mappings'] = json.dumps(template_data['field_mappings'])
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, template_data)
                result = cursor.fetchone()
                return dict(result) if result else None
        except Exception as e:
            logger.error(f"Error creating mapping template: {e}")
            raise
    
    @staticmethod
    def get_all_mapping_templates() -> List[Dict[str, Any]]:
        """Get all mapping templates from the database"""
        query = "SELECT * FROM mdm_mapping_templates ORDER BY created_at DESC;"
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query)
                templates = [dict(row) for row in cursor.fetchall()]
                
                # Parse JSON fields
                for template in templates:
                    if isinstance(template.get('expected_schema'), str):
                        try:
                            template['expected_schema'] = json.loads(template['expected_schema'])
                        except:
                            template['expected_schema'] = {}
                            
                    if isinstance(template.get('field_mappings'), str):
                        try:
                            template['field_mappings'] = json.loads(template['field_mappings'])
                        except:
                            template['field_mappings'] = []
                
                return templates
        except Exception as e:
            logger.error(f"Error retrieving mapping templates: {e}")
            raise
    
    @staticmethod
    def get_mapping_template_by_id(template_id: str) -> Optional[Dict[str, Any]]:
        """Get a mapping template by ID"""
        query = "SELECT * FROM mdm_mapping_templates WHERE id = %s;"
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, (template_id,))
                result = cursor.fetchone()
                
                if not result:
                    return None
                
                template = dict(result)
                
                # Parse JSON fields
                if isinstance(template.get('expected_schema'), str):
                    try:
                        template['expected_schema'] = json.loads(template['expected_schema'])
                    except:
                        template['expected_schema'] = {}
                        
                if isinstance(template.get('field_mappings'), str):
                    try:
                        template['field_mappings'] = json.loads(template['field_mappings'])
                    except:
                        template['field_mappings'] = []
                
                return template
        except Exception as e:
            logger.error(f"Error retrieving mapping template by ID: {e}")
            raise
    
    @staticmethod
    def get_mapping_templates_by_source_type(source_type: str) -> List[Dict[str, Any]]:
        """Get mapping templates by source type"""
        query = "SELECT * FROM mdm_mapping_templates WHERE source_type = %s ORDER BY created_at DESC;"
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, (source_type,))
                templates = [dict(row) for row in cursor.fetchall()]
                
                # Parse JSON fields
                for template in templates:
                    if isinstance(template.get('expected_schema'), str):
                        try:
                            template['expected_schema'] = json.loads(template['expected_schema'])
                        except:
                            template['expected_schema'] = {}
                            
                    if isinstance(template.get('field_mappings'), str):
                        try:
                            template['field_mappings'] = json.loads(template['field_mappings'])
                        except:
                            template['field_mappings'] = []
                
                return templates
        except Exception as e:
            logger.error(f"Error retrieving mapping templates by source type: {e}")
            raise
    
    @staticmethod
    def log_test_pull(log_data: Dict[str, Any]) -> Optional[int]:
        """Log a test pull attempt in the database"""
        query = """
        INSERT INTO mdm_supplier_test_pulls (
            supplier_id, success, message, sample_data, error_details, 
            schema_validation, mapping_suggestion, mapping_confidence, timestamp
        ) VALUES (
            %(supplier_id)s, %(success)s, %(message)s, %(sample_data)s, %(error_details)s,
            %(schema_validation)s, %(mapping_suggestion)s, %(mapping_confidence)s, %(timestamp)s
        ) RETURNING id;
        """
        
        # Convert JSON fields to strings if they are dictionaries or lists
        for field in ['sample_data', 'error_details', 'schema_validation', 'mapping_suggestion']:
            if isinstance(log_data.get(field), (dict, list)):
                log_data[field] = json.dumps(log_data[field])
        
        # Set default values for new fields if not provided
        if 'schema_validation' not in log_data:
            log_data['schema_validation'] = None
        if 'mapping_suggestion' not in log_data:
            log_data['mapping_suggestion'] = None
        if 'mapping_confidence' not in log_data:
            log_data['mapping_confidence'] = 0.0
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, log_data)
                result = cursor.fetchone()
                return result['id'] if result else None
        except Exception as e:
            logger.error(f"Error logging test pull: {e}")
            raise
    
    @staticmethod
    def get_test_pull_logs(supplier_id: str) -> List[Dict[str, Any]]:
        """Get all test pull logs for a supplier"""
        query = """
        SELECT * FROM mdm_supplier_test_pulls 
        WHERE supplier_id = %s 
        ORDER BY timestamp DESC;
        """
        
        try:
            with get_db_cursor() as cursor:
                cursor.execute(query, (supplier_id,))
                logs = [dict(row) for row in cursor.fetchall()]
                
                # Parse JSON fields
                for log in logs:
                    for field in ['sample_data', 'error_details', 'schema_validation', 'mapping_suggestion']:
                        if isinstance(log.get(field), str):
                            try:
                                log[field] = json.loads(log[field])
                            except:
                                pass
                
                return logs
        except Exception as e:
            logger.error(f"Error retrieving test pull logs: {e}")
            raise


# Initialize the database tables when the module is imported
init_supplier_tables()