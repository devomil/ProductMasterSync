import os
import io
import json
import logging
import requests
import pandas as pd
import pysftp
import paramiko
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Disable known host checking for SFTP
# Note: In production, you'd want to use a known_hosts file
cnopts = pysftp.CnOpts()
cnopts.hostkeys = None  # Warning: Only for development

class DataSourceConnector(ABC):
    """Abstract base class for all data source connectors"""
    
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Test the connection to the data source"""
        pass
    
    @abstractmethod
    def pull_sample_data(self, limit: int = 100) -> Dict[str, Any]:
        """Pull a sample of data from the source"""
        pass


class FTPConnector(DataSourceConnector):
    """Connector for FTP/SFTP data sources"""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize with FTP configuration"""
        self.host = config.get('host')
        self.username = config.get('username')
        self.password = config.get('password')
        self.port = config.get('port', 22)
        self.path = config.get('path', '/')
        self.is_sftp = config.get('is_sftp', True)  # Default to SFTP
        self.private_key_path = config.get('private_key_path')
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the connection to the FTP/SFTP server"""
        try:
            if self.is_sftp:
                conn_params = {
                    'host': self.host,
                    'username': self.username,
                    'port': self.port,
                    'cnopts': cnopts
                }
                
                # Use either password or private key
                if self.private_key_path:
                    conn_params['private_key'] = self.private_key_path
                else:
                    conn_params['password'] = self.password
                
                with pysftp.Connection(**conn_params) as sftp:
                    # Check if the path exists
                    try:
                        sftp.chdir(self.path)
                        path_exists = True
                    except:
                        path_exists = False
                    
                    return {
                        'success': True,
                        'message': f"Successfully connected to SFTP server at {self.host}",
                        'details': {
                            'path_exists': path_exists,
                            'path': self.path
                        }
                    }
            else:
                # Regular FTP implementation would go here
                # For brevity, we'll just return an error
                return {
                    'success': False,
                    'message': "Regular FTP is not implemented in this version",
                    'error_details': {
                        'error_type': "NotImplementedError"
                    }
                }
                
        except Exception as e:
            logger.error(f"FTP/SFTP connection error: {str(e)}")
            return {
                'success': False,
                'message': f"Failed to connect to {'SFTP' if self.is_sftp else 'FTP'} server",
                'error_details': {
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                }
            }
    
    def pull_sample_data(self, limit: int = 100) -> Dict[str, Any]:
        """Pull a sample of data from the FTP/SFTP server"""
        try:
            if not self.is_sftp:
                return {
                    'success': False,
                    'message': "Regular FTP is not implemented in this version",
                    'error_details': {
                        'error_type': "NotImplementedError"
                    }
                }
            
            conn_params = {
                'host': self.host,
                'username': self.username,
                'port': self.port,
                'cnopts': cnopts
            }
            
            # Use either password or private key
            if self.private_key_path:
                conn_params['private_key'] = self.private_key_path
            else:
                conn_params['password'] = self.password
            
            with pysftp.Connection(**conn_params) as sftp:
                # Navigate to the specified path
                try:
                    sftp.chdir(self.path)
                except Exception as e:
                    return {
                        'success': False,
                        'message': f"Path {self.path} not found on server",
                        'error_details': {
                            'error_type': type(e).__name__,
                            'error_message': str(e)
                        }
                    }
                
                # List files in the directory
                file_list = sftp.listdir()
                
                # Filter for data files (CSV, Excel, etc.)
                data_files = [f for f in file_list if f.lower().endswith(('.csv', '.xlsx', '.xls'))]
                
                if not data_files:
                    return {
                        'success': False,
                        'message': "No data files found in the specified path",
                        'error_details': {
                            'path': self.path,
                            'available_files': file_list[:10]  # Show first 10 files
                        }
                    }
                
                # Download and parse the first data file
                sample_file = data_files[0]
                with io.BytesIO() as mem_file:
                    sftp.getfo(sample_file, mem_file)
                    mem_file.seek(0)
                    
                    # Parse based on file type
                    if sample_file.lower().endswith('.csv'):
                        df = pd.read_csv(mem_file, nrows=limit)
                    elif sample_file.lower().endswith(('.xlsx', '.xls')):
                        df = pd.read_excel(mem_file, nrows=limit)
                    else:
                        return {
                            'success': False,
                            'message': f"Unsupported file format: {sample_file}",
                            'error_details': {
                                'file': sample_file
                            }
                        }
                    
                    # Convert DataFrame to dict
                    records = df.to_dict(orient='records')
                    
                    return {
                        'success': True,
                        'message': f"Successfully retrieved {len(records)} records from {sample_file}",
                        'sample_data': records,
                        'details': {
                            'file': sample_file,
                            'total_files': len(data_files),
                            'available_files': data_files[:5]  # First 5 files
                        }
                    }
                
        except Exception as e:
            logger.error(f"Error pulling sample data from SFTP: {str(e)}")
            return {
                'success': False,
                'message': "Failed to pull sample data from SFTP server",
                'error_details': {
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                }
            }


class APIConnector(DataSourceConnector):
    """Connector for API data sources"""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize with API configuration"""
        self.url = config.get('url')
        self.headers = config.get('headers', {})
        self.auth_type = config.get('auth_type', 'none')
        self.username = config.get('username')
        self.password = config.get('password')
        self.token = config.get('token')
        self.oauth_url = config.get('oauth_url')
        self.client_id = config.get('client_id')
        self.client_secret = config.get('client_secret')
        self.pagination_type = config.get('pagination_type')
        self.pagination_params = config.get('pagination_params', {})
    
    def _prepare_auth(self) -> Dict[str, Any]:
        """Prepare authentication for requests"""
        auth = None
        headers = self.headers.copy() if self.headers else {}
        
        if self.auth_type == 'basic':
            auth = (self.username, self.password)
        elif self.auth_type == 'token':
            headers['Authorization'] = f"Bearer {self.token}"
        elif self.auth_type == 'oauth':
            # This is a simplified OAuth implementation
            # In a real app, you'd want to handle token refreshing, etc.
            try:
                oauth_data = {
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                    'grant_type': 'client_credentials'
                }
                
                oauth_response = requests.post(self.oauth_url, data=oauth_data)
                oauth_response.raise_for_status()
                
                token_data = oauth_response.json()
                token = token_data.get('access_token')
                
                if not token:
                    raise ValueError("No access_token in OAuth response")
                
                headers['Authorization'] = f"Bearer {token}"
                
            except Exception as e:
                logger.error(f"OAuth authentication error: {str(e)}")
                raise
        
        return {
            'auth': auth,
            'headers': headers
        }
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the connection to the API"""
        try:
            # Prepare authentication
            auth_data = self._prepare_auth()
            
            # Send a HEAD request to check if the API is accessible
            response = requests.head(
                self.url,
                headers=auth_data['headers'],
                auth=auth_data['auth']
            )
            
            # If HEAD is not supported, try GET
            if response.status_code == 405:  # Method Not Allowed
                response = requests.get(
                    self.url,
                    headers=auth_data['headers'],
                    auth=auth_data['auth']
                )
            
            response.raise_for_status()
            
            return {
                'success': True,
                'message': f"Successfully connected to API at {self.url}",
                'details': {
                    'status_code': response.status_code,
                    'headers': dict(response.headers)
                }
            }
            
        except Exception as e:
            logger.error(f"API connection error: {str(e)}")
            return {
                'success': False,
                'message': f"Failed to connect to API at {self.url}",
                'error_details': {
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                }
            }
    
    def pull_sample_data(self, limit: int = 100) -> Dict[str, Any]:
        """Pull a sample of data from the API"""
        try:
            # Prepare authentication
            auth_data = self._prepare_auth()
            
            params = {}
            
            # Handle pagination based on pagination_type
            if self.pagination_type == 'offset':
                params[self.pagination_params.get('limit_param', 'limit')] = limit
                params[self.pagination_params.get('offset_param', 'offset')] = 0
            elif self.pagination_type == 'page':
                params[self.pagination_params.get('limit_param', 'per_page')] = limit
                params[self.pagination_params.get('page_param', 'page')] = 1
            elif self.pagination_type is None:
                # If no pagination is specified, try to use a common limit parameter
                params['limit'] = limit
            
            response = requests.get(
                self.url,
                params=params,
                headers=auth_data['headers'],
                auth=auth_data['auth']
            )
            
            response.raise_for_status()
            
            # Parse the response data
            response_data = response.json()
            
            # Handle different response formats
            sample_data = []
            
            if isinstance(response_data, list):
                # Response is directly a list of records
                sample_data = response_data[:limit]
            elif isinstance(response_data, dict):
                # Try to find the data array in the response
                # Common field names for data arrays
                possible_data_fields = ['data', 'items', 'results', 'products', 'records']
                
                for field in possible_data_fields:
                    if field in response_data and isinstance(response_data[field], list):
                        sample_data = response_data[field][:limit]
                        break
                
                # If we couldn't find a data array, use the whole response
                if not sample_data:
                    sample_data = [response_data]
            
            return {
                'success': True,
                'message': f"Successfully retrieved {len(sample_data)} records from API",
                'sample_data': sample_data,
                'details': {
                    'url': self.url,
                    'status_code': response.status_code
                }
            }
            
        except Exception as e:
            logger.error(f"Error pulling sample data from API: {str(e)}")
            return {
                'success': False,
                'message': f"Failed to pull sample data from API at {self.url}",
                'error_details': {
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                }
            }


class FileUploadConnector(DataSourceConnector):
    """Connector for file upload data sources"""
    
    def __init__(self, config: Dict[str, Any], uploaded_file_path: Optional[str] = None):
        """Initialize with file upload configuration"""
        self.allowed_extensions = config.get('allowed_extensions', ['csv', 'xlsx', 'xls'])
        self.has_header = config.get('has_header', True)
        self.delimiter = config.get('delimiter', ',')
        self.encoding = config.get('encoding', 'utf-8')
        self.sheet_name = config.get('sheet_name')
        self.uploaded_file_path = uploaded_file_path
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the configuration (no actual connection for file uploads)"""
        if not self.uploaded_file_path:
            return {
                'success': False,
                'message': "No file has been uploaded to test",
                'error_details': {
                    'error_type': "FileNotFoundError"
                }
            }
        
        # Check if the file exists
        if not os.path.exists(self.uploaded_file_path):
            return {
                'success': False,
                'message': f"The uploaded file does not exist at {self.uploaded_file_path}",
                'error_details': {
                    'error_type': "FileNotFoundError"
                }
            }
        
        # Check file extension
        file_ext = os.path.splitext(self.uploaded_file_path)[1][1:].lower()
        if file_ext not in self.allowed_extensions:
            return {
                'success': False,
                'message': f"File extension .{file_ext} is not allowed",
                'error_details': {
                    'allowed_extensions': self.allowed_extensions
                }
            }
        
        return {
            'success': True,
            'message': "File upload configuration is valid",
            'details': {
                'file_path': self.uploaded_file_path,
                'file_extension': file_ext,
                'config': {
                    'has_header': self.has_header,
                    'delimiter': self.delimiter,
                    'encoding': self.encoding,
                    'sheet_name': self.sheet_name
                }
            }
        }
    
    def pull_sample_data(self, limit: int = 100) -> Dict[str, Any]:
        """Pull a sample of data from the uploaded file"""
        if not self.uploaded_file_path or not os.path.exists(self.uploaded_file_path):
            return {
                'success': False,
                'message': "No valid file has been uploaded to sample",
                'error_details': {
                    'error_type': "FileNotFoundError"
                }
            }
        
        try:
            file_ext = os.path.splitext(self.uploaded_file_path)[1][1:].lower()
            
            if file_ext == 'csv':
                df = pd.read_csv(
                    self.uploaded_file_path,
                    delimiter=self.delimiter,
                    encoding=self.encoding,
                    header=0 if self.has_header else None,
                    nrows=limit
                )
            elif file_ext in ['xlsx', 'xls']:
                df = pd.read_excel(
                    self.uploaded_file_path,
                    sheet_name=self.sheet_name,
                    header=0 if self.has_header else None,
                    nrows=limit
                )
            else:
                return {
                    'success': False,
                    'message': f"Unsupported file format: {file_ext}",
                    'error_details': {
                        'file_extension': file_ext,
                        'allowed_extensions': self.allowed_extensions
                    }
                }
            
            # Convert DataFrame to dict
            records = df.to_dict(orient='records')
            
            return {
                'success': True,
                'message': f"Successfully read {len(records)} records from uploaded file",
                'sample_data': records,
                'details': {
                    'file_path': self.uploaded_file_path,
                    'file_extension': file_ext,
                    'total_columns': len(df.columns),
                    'columns': df.columns.tolist()
                }
            }
            
        except Exception as e:
            logger.error(f"Error reading uploaded file: {str(e)}")
            return {
                'success': False,
                'message': f"Failed to read data from uploaded file",
                'error_details': {
                    'error_type': type(e).__name__,
                    'error_message': str(e)
                }
            }


# Factory function to create the appropriate connector
def create_connector(data_source_type: str, config: Dict[str, Any], **kwargs) -> DataSourceConnector:
    """Create a connector based on the data source type"""
    if data_source_type == 'ftp':
        return FTPConnector(config)
    elif data_source_type == 'api':
        return APIConnector(config)
    elif data_source_type == 'file_upload':
        return FileUploadConnector(config, kwargs.get('uploaded_file_path'))
    else:
        raise ValueError(f"Unsupported data source type: {data_source_type}")