// Connections API handling
import { Request, Response } from 'express';
import { db } from './db';
import { connections } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { Client as SFTPClient } from 'ssh2';
import FTP from 'ftp';
import pg from 'pg';

// Helper to apply environment credentials to server SFTP connections
const applySFTPCredentials = (credentials: any, connectConfig: any) => {
  // Use environment variable for password if available and credentials match our expected SFTP server
  if (process.env.SFTP_PASSWORD && 
      connectConfig.host === 'edi.cwrdistribution.com' && 
      connectConfig.username === 'eco8') {
    console.log('Using SFTP_PASSWORD from environment variables');
    connectConfig.password = process.env.SFTP_PASSWORD;
  } else {
    connectConfig.password = credentials.password;
  }
  return connectConfig;
};

// Helper function to test database connection
const testDatabaseConnection = async (credentials: any) => {
  const { host, port, username, password, database } = credentials;
  
  try {
    // Create a client with provided credentials
    const client = new pg.Client({
      host,
      port,
      user: username,
      password,
      database
    });
    
    // Try to connect
    await client.connect();
    
    // Run a simple query to test connectivity
    const result = await client.query('SELECT NOW() as current_time');
    
    // Close the connection
    await client.end();
    
    return {
      success: true,
      message: 'Successfully connected to database',
      details: { 
        connection_time: result.rows[0].current_time 
      }
    };
  } catch (error) {
    // Handle connection errors
    return {
      success: false,
      message: `Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
};

// Helper function to test SFTP connection
const testSFTPConnection = async (credentials: any) => {
  return new Promise((resolve) => {
    const client = new SFTPClient();
    
    // Set a timeout to avoid hanging connections
    const timeout = setTimeout(() => {
      client.end();
      resolve({ 
        success: false, 
        message: 'Connection timed out' 
      });
    }, 30000); // 30 seconds timeout
    
    // Prepare connection config
    const connectConfig: any = {
      host: credentials.host,
      port: credentials.port || 22,
      username: credentials.username
    };
    
    // Handle authentication
    if (credentials.privateKey && credentials.requiresPrivateKey) {
      connectConfig.privateKey = credentials.privateKey;
      
      if (credentials.passphrase) {
        connectConfig.passphrase = credentials.passphrase;
      }
    } else {
      connectConfig.password = credentials.password;
    }
    
    client.on('ready', () => {
      clearTimeout(timeout);
      
      // Start SFTP session
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          resolve({ 
            success: false, 
            message: `SFTP session error: ${err.message}` 
          });
          return;
        }
        
        // Read directory to confirm SFTP access
        sftp.readdir('.', (err, list) => {
          client.end();
          
          if (err) {
            resolve({ 
              success: false, 
              message: `SFTP directory listing failed: ${err.message}` 
            });
            return;
          }
          
          // Filter for files only (not directories)
          const files = list.filter(item => item.attrs.isFile());
          
          resolve({ 
            success: true, 
            message: 'SFTP connection successful',
            details: {
              file_count: files.length,
              files: files.slice(0, 5).map(f => f.filename)
            }
          });
        });
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end();
      resolve({ 
        success: false, 
        message: `SFTP connection error: ${err.message}` 
      });
    });
    
    client.connect(connectConfig);
  });
};

// Helper function to test FTP connection
const testFTPConnection = async (credentials: any) => {
  return new Promise((resolve) => {
    const client = new FTP();
    
    // Set a timeout to avoid hanging connections
    const timeout = setTimeout(() => {
      client.end();
      resolve({ 
        success: false, 
        message: 'Connection timed out' 
      });
    }, 30000); // 30 seconds timeout
    
    client.on('ready', () => {
      clearTimeout(timeout);
      
      // Try to list the directory
      client.list((err, list) => {
        client.end();
        
        if (err) {
          resolve({ 
            success: false, 
            message: `FTP directory listing failed: ${err.message}` 
          });
          return;
        }
        
        resolve({ 
          success: true, 
          message: 'FTP connection successful',
          details: {
            file_count: list.length,
            files: list.slice(0, 5).map((item: any) => item.name)
          }
        });
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end();
      resolve({ 
        success: false, 
        message: `FTP connection error: ${err.message}` 
      });
    });
    
    // Prepare connection config
    client.connect({
      host: credentials.host,
      port: credentials.port || 21,
      user: credentials.username,
      password: credentials.password,
      secure: credentials.secure || false
    });
  });
};

// Helper function to test API connection
const testAPIConnection = async (credentials: any) => {
  try {
    const { url, auth_type, headers = {} } = credentials;
    
    if (!url) {
      return { 
        success: false, 
        message: 'API URL is required' 
      };
    }
    
    const options: RequestInit = {
      headers: headers
    };
    
    // Add authentication if needed
    if (auth_type === 'basic' && credentials.username && credentials.password) {
      const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
      options.headers = {
        ...options.headers,
        'Authorization': `Basic ${auth}`
      };
    } else if (auth_type === 'token' && credentials.token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${credentials.token}`
      };
    }
    
    // Make request
    const response = await fetch(url, options);
    const status = response.status;
    
    // Only read body for reasonable response sizes
    const contentLength = response.headers.get('content-length');
    let responseBody;
    
    // Only try to parse JSON responses under 100KB to avoid excessive memory usage
    if (contentLength && parseInt(contentLength) < 100000) {
      try {
        responseBody = await response.json();
      } catch {
        responseBody = '<non-JSON response>';
      }
    } else {
      responseBody = '<response body too large>';
    }
    
    if (status >= 200 && status < 300) {
      return {
        success: true,
        message: 'API connection successful',
        details: { 
          status,
          sample_response: responseBody
        }
      };
    } else {
      return {
        success: false,
        message: `API request failed with status ${status}`,
        details: { 
          status,
          response: responseBody
        }
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `API connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: { error }
    };
  }
};

// Controller to get all connections
export const getConnections = async (req: Request, res: Response) => {
  try {
    const allConnections = await db.select().from(connections);
    res.json(allConnections);
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching connections' 
    });
  }
};

// Controller to get a single connection
export const getConnection = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid connection ID' 
      });
    }
    
    const connection = await db.select().from(connections).where(eq(connections.id, id));
    
    if (connection.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Connection not found' 
      });
    }
    
    res.json(connection[0]);
  } catch (error) {
    console.error('Error fetching connection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching connection' 
    });
  }
};

// Controller to create a connection
export const createConnection = async (req: Request, res: Response) => {
  try {
    const { name, type, config, supplier_id } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and type are required' 
      });
    }
    
    const [newConnection] = await db.insert(connections)
      .values({
        name,
        type,
        config,
        supplierId: supplier_id || null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    res.status(201).json(newConnection);
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating connection' 
    });
  }
};

// Controller to update a connection
export const updateConnection = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, type, config, supplier_id, active } = req.body;
    
    if (isNaN(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid connection ID' 
      });
    }
    
    // Check if connection exists
    const existingConnection = await db.select().from(connections).where(eq(connections.id, id));
    
    if (existingConnection.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Connection not found' 
      });
    }
    
    // Update the connection
    const [updatedConnection] = await db.update(connections)
      .set({
        name: name !== undefined ? name : existingConnection[0].name,
        type: type !== undefined ? type : existingConnection[0].type,
        config: config !== undefined ? config : existingConnection[0].config,
        supplierId: supplier_id !== undefined ? supplier_id : existingConnection[0].supplierId,
        active: active !== undefined ? active : existingConnection[0].active,
        updatedAt: new Date()
      })
      .where(eq(connections.id, id))
      .returning();
    
    res.json(updatedConnection);
  } catch (error) {
    console.error('Error updating connection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating connection' 
    });
  }
};

// Controller to delete a connection
export const deleteConnection = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid connection ID' 
      });
    }
    
    // Check if connection exists
    const existingConnection = await db.select().from(connections).where(eq(connections.id, id));
    
    if (existingConnection.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Connection not found' 
      });
    }
    
    // Delete the connection
    await db.delete(connections).where(eq(connections.id, id));
    
    res.json({ 
      success: true, 
      message: 'Connection deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting connection' 
    });
  }
};

// Controller to test connection
export const testConnection = async (req: Request, res: Response) => {
  try {
    const { type, credentials } = req.body;
    
    if (!type || !credentials) {
      return res.status(400).json({ 
        success: false, 
        message: 'Connection type and credentials are required' 
      });
    }
    
    let testResult: any;
    
    // Test different connection types
    switch (type) {
      case 'sftp':
        testResult = await testSFTPConnection(credentials);
        break;
      
      case 'ftp':
        testResult = await testFTPConnection(credentials);
        break;
      
      case 'api':
        testResult = await testAPIConnection(credentials);
        break;
      
      case 'database':
        testResult = await testDatabaseConnection(credentials);
        break;
      
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Unsupported connection type' 
        });
    }
    
    // Update connection status in the database if connection ID is provided
    if (req.query.id) {
      const connectionId = parseInt(req.query.id as string);
      
      await db.update(connections)
        .set({
          lastTested: new Date(),
          lastStatus: testResult.success ? 'success' : 'error',
          updatedAt: new Date()
        })
        .where(eq(connections.id, connectionId));
    }
    
    res.json(testResult);
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error testing connection', 
      details: { error: error instanceof Error ? error.message : 'Unknown error' } 
    });
  }
};

// Function to pull sample product data from SFTP
export const pullSampleData = async (req: Request, res: Response) => {
  try {
    // Ensure proper request body format
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is required'
      });
    }
    
    const { type, credentials, supplier_id, limit = 100, remote_path, specific_path } = req.body;
    
    console.log('Pull sample data request:', { type, supplier_id, limit, remote_path, specific_path });
    
    // Validate credentials
    if (!credentials) {
      return res.status(400).json({
        success: false,
        message: 'Connection credentials are required'
      });
    }
    
    if (typeof credentials === 'string') {
      try {
        // Try to parse it if it's a string
        req.body.credentials = JSON.parse(credentials);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials format. Must be a valid JSON object'
        });
      }
    }
    
    console.log('Credentials structure:', Object.keys(credentials));
    
    // Use specific_path in credentials if provided in the request
    if (specific_path && credentials) {
      credentials.specific_path = specific_path;
    }
    
    if (!type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Connection type is required' 
      });
    }
    
    let result: any;
    
    // Handle different connection types
    switch (type) {
      case 'sftp':
        try {
          result = await pullSampleDataFromSFTP(credentials, supplier_id, limit, remote_path);
        } catch (sftpError) {
          console.error('SFTP sample data pull error:', sftpError);
          result = {
            success: false,
            message: `SFTP error: ${sftpError instanceof Error ? sftpError.message : 'Unknown SFTP error'}`
          };
        }
        break;
      
      case 'ftp':
        try {
          result = await pullSampleDataFromFTP(credentials, supplier_id, limit);
        } catch (ftpError) {
          console.error('FTP sample data pull error:', ftpError);
          result = {
            success: false,
            message: `FTP error: ${ftpError instanceof Error ? ftpError.message : 'Unknown FTP error'}`
          };
        }
        break;
      
      case 'api':
        result = {
          success: false,
          message: 'API sample data pull not implemented yet'
        };
        break;
      
      default:
        return res.status(400).json({ 
          success: false, 
          message: `Unsupported connection type: ${type}` 
        });
    }
    
    // Ensure proper result format
    if (!result) {
      result = {
        success: false,
        message: 'No result was returned from sample data pull'
      };
    }
    
    // Set proper content type and send response
    res.setHeader('Content-Type', 'application/json');
    res.json(result);
  } catch (error) {
    console.error('Error pulling sample data:', error);
    // Set proper content type to ensure client can parse it
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ 
      success: false, 
      message: 'Error pulling sample data', 
      details: { error: error instanceof Error ? error.message : 'Unknown error' } 
    });
  }
};

// Helper function to pull sample data from SFTP connection
const pullSampleDataFromSFTP = async (
  credentials: any, 
  supplierId: number,
  limit: number = 100,
  remote_path?: string
): Promise<{ 
  success: boolean, 
  message: string, 
  data?: any[],
  filename?: string,
  fileType?: string,
  remote_path?: string,
  total_records?: number
}> => {
  console.log('SFTP sample data function called with remote_path:', remote_path);
  return new Promise((resolve) => {
    const client = new SFTPClient();
    
    // Set a timeout to avoid hanging connections
    const timeout = setTimeout(() => {
      client.end();
      resolve({ 
        success: false, 
        message: 'Connection timed out' 
      });
    }, 30000); // 30 seconds timeout
    
    // Prepare connection config
    const connectConfig: any = {
      host: credentials.host,
      port: credentials.port || 22,
      username: credentials.username
    };
    
    // Handle authentication
    if (credentials.privateKey && credentials.requiresPrivateKey) {
      connectConfig.privateKey = credentials.privateKey;
      
      if (credentials.passphrase) {
        connectConfig.passphrase = credentials.passphrase;
      }
    } else {
      connectConfig.password = credentials.password;
    }
    
    client.on('ready', () => {
      clearTimeout(timeout);
      
      // Start SFTP session
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          resolve({ 
            success: false, 
            message: `SFTP session error: ${err.message}` 
          });
          return;
        }
        
        // Determine paths to check
        const pathsToCheck: string[] = [];
        
        // If a specific remote_path is passed as a parameter, use only that one
        if (remote_path) {
          console.log('Using specific path from parameter:', remote_path);
          pathsToCheck.push(remote_path);
        }
        // If a specific path is in the credentials (from client)
        else if (credentials.specific_path) {
          console.log('Using specific path from credentials:', credentials.specific_path);
          pathsToCheck.push(credentials.specific_path);
        }
        // Otherwise use standard paths from configuration 
        else if (credentials.remoteDir) {
          pathsToCheck.push(credentials.remoteDir);
        } else if (Array.isArray(credentials.remote_paths) && credentials.remote_paths.length > 0) {
          // Add all specified paths
          credentials.remote_paths.forEach((pathObj: any) => {
            pathsToCheck.push(pathObj.path);
          });
        } else {
          // Default to home directory
          pathsToCheck.push('.');
        }
        
        // Function to process a specific file once it's identified
        const processFile = async (filePath: string, fileType: string, filename: string) => {
          try {
            console.log(`Processing file: ${filePath}, type: ${fileType}`);
            const chunks: Buffer[] = [];
            let totalLength = 0;
            const stream = sftp.createReadStream(filePath);
            
            stream.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
              totalLength += chunk.length;
              
              // Prevent downloading the entire file if it's very large
              if (totalLength > 5 * 1024 * 1024) { // 5 MB limit
                stream.close();
              }
            });
            
            stream.on('end', async () => {
              client.end();
              const content = Buffer.concat(chunks).toString('utf8');
              
              // Process the file content based on type
              try {
                let parsedData: any[] = [];
                let total = 0;
                
                if (fileType === 'csv') {
                  // Basic CSV parsing
                  const lines = content.split(/\r?\n/);
                  if (lines.length === 0) {
                    resolve({ 
                      success: false, 
                      message: 'CSV file is empty' 
                    });
                    return;
                  }
                  
                  // Assume first row is header
                  const headers = lines[0].split(',').map(h => h.trim());
                  total = lines.length - 1;
                  
                  // Get data rows (limit to requested amount)
                  const dataRows = lines.slice(1, Math.min(lines.length, limit + 1));
                  
                  parsedData = dataRows.map(line => {
                    const values = line.split(',').map(v => v.trim());
                    const row: any = {};
                    
                    headers.forEach((header, i) => {
                      row[header] = values[i] || '';
                    });
                    
                    return row;
                  });
                } else if (fileType === 'json') {
                  // Parse JSON
                  const jsonData = JSON.parse(content);
                  
                  if (Array.isArray(jsonData)) {
                    total = jsonData.length;
                    parsedData = jsonData.slice(0, limit);
                  } else if (jsonData && typeof jsonData === 'object') {
                    // Handle case when JSON is an object, not an array
                    if (jsonData.data && Array.isArray(jsonData.data)) {
                      total = jsonData.data.length;
                      parsedData = jsonData.data.slice(0, limit);
                    } else {
                      // Single object
                      parsedData = [jsonData];
                      total = 1;
                    }
                  }
                } else {
                  // Excel parsing would go here - omitted for simplicity
                  parsedData = [{ message: "Excel parsing not implemented in sample data" }];
                  total = 1;
                }
                
                resolve({
                  success: true,
                  message: `Successfully pulled sample data from ${filename}`,
                  data: parsedData,
                  filename: filename,
                  fileType: fileType,
                  remote_path: filePath,
                  total_records: total
                });
              } catch (parseError: any) {
                resolve({
                  success: false,
                  message: `Error parsing file: ${parseError.message}`,
                  filename: filename,
                  remote_path: filePath
                });
              }
            });
            
            stream.on('error', (streamErr) => {
              client.end();
              resolve({
                success: false,
                message: `Error reading file: ${streamErr.message}`,
                filename: filename,
                remote_path: filePath
              });
            });
          } catch (e: any) {
            client.end();
            resolve({
              success: false,
              message: `Error processing file: ${e.message}`,
              filename: filename,
              remote_path: filePath
            });
          }
        };
        
        // Function to check each path and download/process a sample file
        const processPaths = async (index = 0) => {
          if (index >= pathsToCheck.length) {
            client.end();
            resolve({ 
              success: false, 
              message: 'No suitable files found in the specified paths' 
            });
            return;
          }
          
          const currentPath = pathsToCheck[index];
          console.log(`Processing path: ${currentPath}`);
          
          // First, try to stat the path to see if it's a file or directory
          sftp.stat(currentPath, (statErr, stats) => {
            if (statErr) {
              console.error(`Cannot access path ${currentPath}:`, statErr.message);
              processPaths(index + 1);
              return;
            }
            
            // If it's a file, process it directly
            if (stats.isFile()) {
              console.log(`${currentPath} is a file, processing directly`);
              const filename = currentPath.split('/').pop() || '';
              const fileExt = filename.split('.').pop()?.toLowerCase() || '';
              
              // Check if it's a supported file type
              if (['csv', 'xlsx', 'xls', 'json'].includes(fileExt)) {
                const fileType = fileExt === 'csv' ? 'csv' : 
                              fileExt === 'json' ? 'json' : 'excel';
                              
                processFile(currentPath, fileType, filename);
                return;
              } else {
                console.log(`File ${currentPath} is not a supported type`);
                processPaths(index + 1);
                return;
              }
            }
            
            // It's a directory, list its contents
            const dirPath = currentPath;
            console.log(`${currentPath} is a directory, listing contents`);
            
            sftp.readdir(dirPath, async (err, list) => {
              if (err) {
                console.error(`Error reading directory ${dirPath}:`, err.message);
                processPaths(index + 1);
                return;
              }
              
              // Filter for CSV, Excel or JSON files
              const files = list.filter(item => {
                const filename = item.filename.toLowerCase();
                return filename.endsWith('.csv') || 
                       filename.endsWith('.xlsx') || 
                       filename.endsWith('.xls') || 
                       filename.endsWith('.json');
              });
              
              // We're looking at a directory listing now
              if (files.length === 0) {
                // No suitable files, try next path
                console.log(`No suitable files found in directory ${dirPath}`);
                processPaths(index + 1);
                return;
              }
              
              // Check if we were looking for a specific file in this directory
              // The path might be a directory but we were actually looking for a file
              const lastPathComponent = currentPath.split('/').pop() || '';
              if (lastPathComponent.includes('.')) {
                // Path looks like a file name, see if it's in this directory
                const targetFilename = lastPathComponent;
                const targetFile = files.find(f => f.filename.toLowerCase() === targetFilename.toLowerCase());
                
                if (targetFile) {
                  // Found the file! Process it
                  console.log(`Found specific file ${targetFile.filename} in directory ${dirPath}`);
                  const fullPath = `${dirPath === '/' ? '' : dirPath}/${targetFile.filename}`;
                  const fileExt = targetFile.filename.split('.').pop()?.toLowerCase() || '';
                  const fileType = fileExt === 'csv' ? 'csv' : 
                                fileExt === 'json' ? 'json' : 'excel';
                                
                  processFile(fullPath, fileType, targetFile.filename);
                  return;
                } else {
                  // File specified but not found
                  console.log(`Specified file ${targetFilename} not found in directory ${dirPath}`);
                  client.end();
                  resolve({
                    success: false,
                    message: `File "${targetFilename}" not found in directory "${dirPath}". The directory exists but the specific file was not found.`,
                    remote_path: currentPath
                  });
                  return;
                }
              }
              
              // We're not looking for a specific file, pick the first suitable one
              const targetFile = files[0];
              console.log(`Choosing first suitable file: ${targetFile.filename}`);
              
              // Get remote file path
              const remoteFilePath = `${dirPath === '/' ? '' : dirPath}/${targetFile.filename}`;
              const fileExt = targetFile.filename.split('.').pop()?.toLowerCase() || '';
              const fileType = fileExt === 'csv' ? 'csv' : 
                             fileExt === 'json' ? 'json' : 'excel';
              
              // Process the file
              processFile(remoteFilePath, fileType, targetFile.filename);
            });
          });
        };
        
        // Start processing the paths
        processPaths();
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end();
      resolve({ 
        success: false, 
        message: `SFTP connection error: ${err.message}` 
      });
    });
    
    client.connect(connectConfig);
  });
};

// Helper function to pull sample data from FTP connection
const pullSampleDataFromFTP = async (
  credentials: any, 
  supplierId: number,
  limit: number = 100
): Promise<{ 
  success: boolean, 
  message: string, 
  data?: any[],
  filename?: string,
  fileType?: string,
  remote_path?: string,
  total_records?: number
}> => {
  return new Promise((resolve) => {
    const client = new FTP();
    
    // Set a timeout to avoid hanging connections
    const timeout = setTimeout(() => {
      client.end();
      resolve({ 
        success: false, 
        message: 'Connection timed out' 
      });
    }, 30000); // 30 seconds timeout
    
    client.on('ready', () => {
      clearTimeout(timeout);
      
      // Try to list the directory
      client.list((err, list) => {
        if (err) {
          client.end();
          resolve({ 
            success: false, 
            message: `FTP directory listing failed: ${err.message}` 
          });
          return;
        }
        
        // Filter for CSV, Excel or JSON files
        const files = list.filter((item: any) => {
          const filename = item.name.toLowerCase();
          return filename.endsWith('.csv') || 
                 filename.endsWith('.xlsx') || 
                 filename.endsWith('.xls') || 
                 filename.endsWith('.json');
        });
        
        if (files.length === 0) {
          client.end();
          resolve({ 
            success: false, 
            message: 'No suitable files found' 
          });
          return;
        }
        
        // Choose the first suitable file
        const targetFile = files[0];
        const fileType = targetFile.name.toLowerCase().endsWith('.csv') ? 'csv' :
                       targetFile.name.toLowerCase().endsWith('.json') ? 'json' : 'excel';
        
        // Get the file
        client.get(targetFile.name, (err, stream) => {
          if (err) {
            client.end();
            resolve({ 
              success: false, 
              message: `Error retrieving file: ${err.message}` 
            });
            return;
          }
          
          const chunks: Buffer[] = [];
          
          stream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          
          stream.on('end', () => {
            client.end();
            const content = Buffer.concat(chunks).toString('utf8');
            
            // Process the file content based on type
            try {
              let parsedData: any[] = [];
              let total = 0;
              
              if (fileType === 'csv') {
                // Basic CSV parsing
                const lines = content.split(/\r?\n/);
                if (lines.length === 0) {
                  resolve({ 
                    success: false, 
                    message: 'CSV file is empty' 
                  });
                  return;
                }
                
                // Assume first row is header
                const headers = lines[0].split(',').map(h => h.trim());
                total = lines.length - 1;
                
                // Get data rows (limit to requested amount)
                const dataRows = lines.slice(1, Math.min(lines.length, limit + 1));
                
                parsedData = dataRows.map(line => {
                  const values = line.split(',').map(v => v.trim());
                  const row: any = {};
                  
                  headers.forEach((header, i) => {
                    row[header] = values[i] || '';
                  });
                  
                  return row;
                });
              } else if (fileType === 'json') {
                // Parse JSON
                const jsonData = JSON.parse(content);
                
                if (Array.isArray(jsonData)) {
                  total = jsonData.length;
                  parsedData = jsonData.slice(0, limit);
                } else if (jsonData && typeof jsonData === 'object') {
                  // Handle case when JSON is an object, not an array
                  if (jsonData.data && Array.isArray(jsonData.data)) {
                    total = jsonData.data.length;
                    parsedData = jsonData.data.slice(0, limit);
                  } else {
                    // Single object
                    parsedData = [jsonData];
                    total = 1;
                  }
                }
              } else {
                // Excel parsing would go here - omitted for simplicity
                parsedData = [{ message: "Excel parsing not implemented in sample data" }];
                total = 1;
              }
              
              resolve({
                success: true,
                message: `Successfully pulled sample data from ${targetFile.name}`,
                data: parsedData,
                filename: targetFile.name,
                fileType: fileType,
                total_records: total
              });
            } catch (error: any) {
              resolve({
                success: false,
                message: `Error parsing file: ${error.message}`,
                filename: targetFile.name
              });
            }
          });
          
          stream.on('error', (err) => {
            client.end();
            resolve({
              success: false,
              message: `Error reading stream: ${err.message}`,
              filename: targetFile.name
            });
          });
        });
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end();
      resolve({ 
        success: false, 
        message: `FTP connection error: ${err.message}` 
      });
    });
    
    // Connect to FTP server
    client.connect({
      host: credentials.host,
      port: credentials.port || 21,
      user: credentials.username,
      password: credentials.password,
      secure: credentials.secure || false
    });
  });
};

// Register routes
export const registerConnectionsRoutes = (app: any) => {
  app.get('/api/connections', getConnections);
  app.get('/api/connections/:id', getConnection);
  app.post('/api/connections', createConnection);
  app.put('/api/connections/:id', updateConnection);
  app.delete('/api/connections/:id', deleteConnection);
  app.post('/api/connections/test', testConnection);
  app.post('/api/connections/pull-sample-data', pullSampleData);
  app.post('/api/connections/sample-data', pullSampleData); // Added alias for client compatibility
};