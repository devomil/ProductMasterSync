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
        
        # Create warehouses table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS warehouses (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(50) NOT NULL,
            address JSONB,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            -- Add indexes
            INDEX idx_warehouses_name (name),
            INDEX idx_warehouses_code (code),
            INDEX idx_warehouses_active (active)
        );
        """)
        
        # Create products table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id VARCHAR(36) PRIMARY KEY,
            sku VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            category_id VARCHAR(36),
            manufacturer_id VARCHAR(36),
            upc VARCHAR(100),
            price DECIMAL(12, 2),
            cost DECIMAL(12, 2),
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            -- Add indexes
            INDEX idx_products_sku (sku),
            INDEX idx_products_name (name),
            INDEX idx_products_category_id (category_id),
            INDEX idx_products_manufacturer_id (manufacturer_id),
            INDEX idx_products_upc (upc),
            INDEX idx_products_status (status)
        );
        """)
        
        # Create product_fulfillment_options table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS product_fulfillment_options (
            id SERIAL PRIMARY KEY,
            product_id VARCHAR(36) NOT NULL UNIQUE,
            internal_stock_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            dropship_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            dropship_supplier_id VARCHAR(36),
            dropship_lead_time_days INTEGER NOT NULL DEFAULT 1,
            bulk_discount_available BOOLEAN NOT NULL DEFAULT FALSE,
            preferred_source VARCHAR(20) NOT NULL DEFAULT 'auto',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            -- Add indexes
            INDEX idx_product_fulfillment_options_product_id (product_id),
            INDEX idx_product_fulfillment_options_dropship_supplier_id (dropship_supplier_id),
            
            -- Add foreign keys
            CONSTRAINT fk_product_fulfillment_options_product_id
                FOREIGN KEY (product_id)
                REFERENCES products(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_product_fulfillment_options_dropship_supplier_id
                FOREIGN KEY (dropship_supplier_id)
                REFERENCES suppliers(id)
                ON DELETE SET NULL
        );
        """)
        
        # Create warehouse_stock table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS warehouse_stock (
            id SERIAL PRIMARY KEY,
            product_id VARCHAR(36) NOT NULL,
            warehouse_id VARCHAR(36) NOT NULL,
            stock_quantity INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            -- Add unique constraint to ensure one record per product/warehouse
            CONSTRAINT uq_warehouse_stock_product_warehouse UNIQUE (product_id, warehouse_id),
            
            -- Add indexes
            INDEX idx_warehouse_stock_product_id (product_id),
            INDEX idx_warehouse_stock_warehouse_id (warehouse_id),
            
            -- Add foreign keys
            CONSTRAINT fk_warehouse_stock_product_id
                FOREIGN KEY (product_id)
                REFERENCES products(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_warehouse_stock_warehouse_id
                FOREIGN KEY (warehouse_id)
                REFERENCES warehouses(id)
                ON DELETE CASCADE
        );
        """)
        
        # Create supplier_inventory table for dropship inventory
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS supplier_inventory (
            id SERIAL PRIMARY KEY,
            product_id VARCHAR(36) NOT NULL,
            supplier_id VARCHAR(36) NOT NULL,
            stock_quantity INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            
            -- Add unique constraint to ensure one record per product/supplier
            CONSTRAINT uq_supplier_inventory_product_supplier UNIQUE (product_id, supplier_id),
            
            -- Add indexes
            INDEX idx_supplier_inventory_product_id (product_id),
            INDEX idx_supplier_inventory_supplier_id (supplier_id),
            
            -- Add foreign keys
            CONSTRAINT fk_supplier_inventory_product_id
                FOREIGN KEY (product_id)
                REFERENCES products(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_supplier_inventory_supplier_id
                FOREIGN KEY (supplier_id)
                REFERENCES suppliers(id)
                ON DELETE CASCADE
        );
        """)
        
        logger.info("Database initialized successfully")


class ProductFulfillmentRepository:
    """Repository for product fulfillment related database operations"""
    
    @staticmethod
    def get_warehouses():
        """Get all warehouses"""
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM warehouses WHERE active = TRUE ORDER BY name;")
            return [dict(warehouse) for warehouse in cursor.fetchall()]
    
    @staticmethod
    def get_warehouse(warehouse_id):
        """Get a warehouse by ID"""
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM warehouses WHERE id = %s;", (warehouse_id,))
            warehouse = cursor.fetchone()
            return dict(warehouse) if warehouse else None
    
    @staticmethod
    def get_product_fulfillment(product_id):
        """Get fulfillment information for a product"""
        with get_db_cursor() as cursor:
            # Get the core fulfillment options
            cursor.execute("""
            SELECT * FROM product_fulfillment_options
            WHERE product_id = %s;
            """, (product_id,))
            
            fulfillment_options = cursor.fetchone()
            if not fulfillment_options:
                return None
            
            fulfillment_dict = dict(fulfillment_options)
            
            # Get warehouse stock information
            cursor.execute("""
            SELECT ws.warehouse_id, w.name as location, ws.stock_quantity as stock
            FROM warehouse_stock ws
            JOIN warehouses w ON ws.warehouse_id = w.id
            WHERE ws.product_id = %s;
            """, (product_id,))
            
            warehouses = [{"location": row["location"], "stock": row["stock"]} for row in cursor.fetchall()]
            
            # Get supplier dropship stock if enabled
            if fulfillment_dict.get("dropship_enabled") and fulfillment_dict.get("dropship_supplier_id"):
                cursor.execute("""
                SELECT stock_quantity
                FROM supplier_inventory
                WHERE product_id = %s AND supplier_id = %s;
                """, (product_id, fulfillment_dict["dropship_supplier_id"]))
                
                supplier_stock = cursor.fetchone()
                dropship_stock = supplier_stock["stock_quantity"] if supplier_stock else 0
            else:
                dropship_stock = 0
            
            # Format the response according to API model
            result = {
                "internal_stock": {
                    "enabled": fulfillment_dict["internal_stock_enabled"],
                    "warehouses": warehouses
                },
                "dropship": {
                    "enabled": fulfillment_dict["dropship_enabled"],
                    "supplier_id": fulfillment_dict["dropship_supplier_id"],
                    "stock": dropship_stock,
                    "lead_time_days": fulfillment_dict["dropship_lead_time_days"]
                },
                "bulk_discount_available": fulfillment_dict["bulk_discount_available"],
                "preferred_source": fulfillment_dict["preferred_source"]
            }
            
            return result
    
    @staticmethod
    def update_product_fulfillment(product_id, fulfillment_data):
        """Update fulfillment options for a product"""
        with get_db_cursor() as cursor:
            # First check if product exists
            cursor.execute("SELECT id FROM products WHERE id = %s;", (product_id,))
            if not cursor.fetchone():
                return {"error": "Product not found"}
            
            # Begin transaction
            cursor.execute("BEGIN;")
            
            try:
                # Check if fulfillment options exist for this product
                cursor.execute("""
                SELECT id FROM product_fulfillment_options
                WHERE product_id = %s;
                """, (product_id,))
                
                fulfillment_exists = cursor.fetchone()
                
                if not fulfillment_exists:
                    # Create new fulfillment options record
                    cursor.execute("""
                    INSERT INTO product_fulfillment_options (
                        product_id, 
                        internal_stock_enabled, 
                        dropship_enabled, 
                        dropship_supplier_id, 
                        dropship_lead_time_days,
                        bulk_discount_available, 
                        preferred_source
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s
                    );
                    """, (
                        product_id,
                        fulfillment_data.get("internal_stock", {}).get("enabled", True),
                        fulfillment_data.get("dropship", {}).get("enabled", False),
                        fulfillment_data.get("dropship", {}).get("supplier_id"),
                        fulfillment_data.get("dropship", {}).get("lead_time_days", 1),
                        fulfillment_data.get("bulk_discount_available", False),
                        fulfillment_data.get("preferred_source", "auto")
                    ))
                else:
                    # Update existing fulfillment options
                    update_fields = []
                    update_values = []
                    
                    if "internal_stock" in fulfillment_data:
                        update_fields.append("internal_stock_enabled = %s")
                        update_values.append(fulfillment_data["internal_stock"].get("enabled", True))
                    
                    if "dropship" in fulfillment_data:
                        dropship = fulfillment_data["dropship"]
                        if "enabled" in dropship:
                            update_fields.append("dropship_enabled = %s")
                            update_values.append(dropship["enabled"])
                        
                        if "supplier_id" in dropship:
                            update_fields.append("dropship_supplier_id = %s")
                            update_values.append(dropship["supplier_id"])
                        
                        if "lead_time_days" in dropship:
                            update_fields.append("dropship_lead_time_days = %s")
                            update_values.append(dropship["lead_time_days"])
                    
                    if "bulk_discount_available" in fulfillment_data:
                        update_fields.append("bulk_discount_available = %s")
                        update_values.append(fulfillment_data["bulk_discount_available"])
                    
                    if "preferred_source" in fulfillment_data:
                        update_fields.append("preferred_source = %s")
                        update_values.append(fulfillment_data["preferred_source"])
                    
                    if update_fields:
                        update_fields.append("updated_at = NOW()")
                        update_sql = f"""
                        UPDATE product_fulfillment_options
                        SET {", ".join(update_fields)}
                        WHERE product_id = %s;
                        """
                        update_values.append(product_id)
                        cursor.execute(update_sql, update_values)
                
                # Handle warehouse stock updates if provided
                if "internal_stock" in fulfillment_data and "warehouses" in fulfillment_data["internal_stock"]:
                    for warehouse in fulfillment_data["internal_stock"]["warehouses"]:
                        # First, find the warehouse ID by location name
                        cursor.execute("""
                        SELECT id FROM warehouses WHERE name = %s;
                        """, (warehouse["location"],))
                        
                        warehouse_record = cursor.fetchone()
                        if not warehouse_record:
                            # Create a new warehouse if it doesn't exist
                            warehouse_id = str(uuid.uuid4())
                            cursor.execute("""
                            INSERT INTO warehouses (id, name, code)
                            VALUES (%s, %s, %s);
                            """, (
                                warehouse_id,
                                warehouse["location"],
                                warehouse["location"].replace(" ", "_").upper()
                            ))
                        else:
                            warehouse_id = warehouse_record["id"]
                        
                        # Update or insert stock for this warehouse
                        cursor.execute("""
                        INSERT INTO warehouse_stock (product_id, warehouse_id, stock_quantity)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (product_id, warehouse_id) 
                        DO UPDATE SET 
                            stock_quantity = %s,
                            updated_at = NOW();
                        """, (
                            product_id,
                            warehouse_id,
                            warehouse["stock"],
                            warehouse["stock"]
                        ))
                
                # Handle supplier inventory updates if provided
                if "dropship" in fulfillment_data and "supplier_id" in fulfillment_data["dropship"] and "stock" in fulfillment_data["dropship"]:
                    supplier_id = fulfillment_data["dropship"]["supplier_id"]
                    stock = fulfillment_data["dropship"]["stock"]
                    
                    # Verify supplier exists
                    cursor.execute("SELECT id FROM suppliers WHERE id = %s;", (supplier_id,))
                    if cursor.fetchone():
                        cursor.execute("""
                        INSERT INTO supplier_inventory (product_id, supplier_id, stock_quantity)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (product_id, supplier_id) 
                        DO UPDATE SET 
                            stock_quantity = %s,
                            updated_at = NOW();
                        """, (
                            product_id,
                            supplier_id,
                            stock,
                            stock
                        ))
                
                # Commit transaction if all operations succeed
                cursor.execute("COMMIT;")
                
                # Return the updated fulfillment information
                return ProductFulfillmentRepository.get_product_fulfillment(product_id)
                
            except Exception as e:
                # Roll back transaction on error
                cursor.execute("ROLLBACK;")
                logger.error(f"Error updating product fulfillment: {str(e)}")
                return {"error": str(e)}
    
    @staticmethod
    def get_total_stock(product_id):
        """Get total stock across all warehouses and suppliers"""
        with get_db_cursor() as cursor:
            # Get warehouse stock
            cursor.execute("""
            SELECT SUM(stock_quantity) as warehouse_stock
            FROM warehouse_stock
            WHERE product_id = %s;
            """, (product_id,))
            
            warehouse_result = cursor.fetchone()
            warehouse_stock = warehouse_result["warehouse_stock"] if warehouse_result and warehouse_result["warehouse_stock"] else 0
            
            # Get supplier inventory
            cursor.execute("""
            SELECT SUM(stock_quantity) as supplier_stock
            FROM supplier_inventory
            WHERE product_id = %s;
            """, (product_id,))
            
            supplier_result = cursor.fetchone()
            supplier_stock = supplier_result["supplier_stock"] if supplier_result and supplier_result["supplier_stock"] else 0
            
            return {
                "warehouse_stock": warehouse_stock,
                "supplier_stock": supplier_stock,
                "total_stock": warehouse_stock + supplier_stock
            }


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