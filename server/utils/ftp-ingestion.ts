import FTP from 'ftp';
import { Client as SFTPClient } from 'ssh2';
import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import { db } from '../db';
import { connections, imports, importStatusEnum } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { processCSVFile, processExcelFile } from './file-processor';

// Interface for the FTP/SFTP connection credentials
interface FTPCredentials {
  host: string;
  port?: number;
  username: string;
  password?: string;
  secure?: boolean;
  remoteDir?: string;
  privateKey?: string;
  passphrase?: string;
  filePattern?: string; // For matching specific files, e.g., "*.csv"
}

/**
 * Pull a sample from an SFTP file for preview/mapping
 */
export const pullSampleFromSFTP = async (
  credentials: FTPCredentials,
  specificFilePath: string,
  options: {
    limit?: number;
    hasHeader?: boolean;
    delimiter?: string;
    encoding?: string;
  } = {}
): Promise<{
  success: boolean;
  message: string;
  records?: any[];
  headers?: string[];
  error?: any;
}> => {
  const result = {
    success: false,
    message: '',
    records: [] as any[],
    headers: [] as string[],
    error: null as any
  };
  
  const limit = options.limit || 50;
  const tempFilePath = path.join(process.cwd(), 'uploads', 'temp', `sample_${Date.now()}.csv`);
  
  // Make sure temp directory exists
  await ensureLocalDir(path.dirname(tempFilePath));
  
  return new Promise((resolve) => {
    const client = new SFTPClient();
    
    // Set a timeout to avoid hanging connections
    const timeout = setTimeout(() => {
      client.end();
      result.message = 'Connection timed out';
      resolve(result);
    }, 30000); // 30 seconds timeout
    
    client.on('ready', async () => {
      clearTimeout(timeout);
      
      try {
        // Use SFTP to get the file
        client.sftp(async (err, sftp) => {
          if (err) {
            client.end();
            result.message = `Failed to start SFTP session: ${err.message}`;
            result.error = err;
            resolve(result);
            return;
          }
          
          // Download the specific file to temp location
          try {
            await new Promise<void>((resolveDownload, rejectDownload) => {
              sftp.fastGet(specificFilePath, tempFilePath, {}, (err) => {
                if (err) {
                  rejectDownload(err);
                  return;
                }
                resolveDownload();
              });
            });
            
            // Process the file based on its type
            let fileData;
            if (specificFilePath.endsWith('.csv')) {
              fileData = await processCSVFile(tempFilePath, {
                hasHeader: options.hasHeader !== false,
                delimiter: options.delimiter || ',',
                encoding: options.encoding || 'utf8'
              });
            } else if (specificFilePath.endsWith('.xlsx') || specificFilePath.endsWith('.xls')) {
              fileData = await processExcelFile(tempFilePath);
            } else {
              // Read the file as text for other formats
              const content = await fs.readFile(tempFilePath, 'utf8');
              fileData = {
                records: [{ content }],
                headers: ['content']
              };
            }
            
            // Limit the number of records
            result.records = fileData.records.slice(0, limit);
            result.headers = fileData.headers;
            result.success = true;
            result.message = `Successfully pulled ${result.records.length} records from ${specificFilePath}`;
            
            // Clean up temporary file
            try {
              await fs.unlink(tempFilePath);
            } catch (cleanupErr) {
              console.warn(`Failed to clean up temp file ${tempFilePath}:`, cleanupErr);
            }
            
          } catch (downloadErr) {
            result.message = `Failed to download file: ${downloadErr instanceof Error ? downloadErr.message : String(downloadErr)}`;
            result.error = downloadErr;
          }
          
          client.end();
          resolve(result);
        });
      } catch (error) {
        client.end();
        result.message = `Error during SFTP operations: ${error instanceof Error ? error.message : String(error)}`;
        result.error = error;
        resolve(result);
      }
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      result.message = `SFTP connection error: ${err.message}`;
      result.error = err;
      resolve(result);
    });
    
    // Connect to the SFTP server
    const connectOptions: any = {
      host: credentials.host,
      port: credentials.port || 22,
      username: credentials.username
    };
    
    // Add password or private key authentication
    if (credentials.password) {
      connectOptions.password = credentials.password;
    } else if (credentials.privateKey) {
      connectOptions.privateKey = credentials.privateKey;
      if (credentials.passphrase) {
        connectOptions.passphrase = credentials.passphrase;
      }
    }
    
    client.connect(connectOptions);
  });
};

interface IngestionResult {
  success: boolean;
  message: string;
  filesPulled: string[];
  filesSkipped: string[];
  errors: any[];
}

// Helper function to match files against a pattern
const matchesPattern = (filename: string, pattern?: string): boolean => {
  if (!pattern) return true;
  
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
    
  return new RegExp(`^${regexPattern}$`).test(filename);
};

// Helper to create local directory if it doesn't exist
const ensureLocalDir = async (dirPath: string): Promise<void> => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    throw error;
  }
};

// Get the uploads directory path
const getUploadsPath = (): string => {
  return path.join(process.cwd(), 'uploads');
};

// Check if a file was previously imported to avoid duplicates
const wasFileImported = async (filename: string, supplierId: number): Promise<boolean> => {
  const previousImports = await db.select({ id: imports.id })
    .from(imports)
    .where(
      and(
        eq(imports.filename, filename),
        eq(imports.supplierId, supplierId)
      )
    )
    .limit(1);
    
  return previousImports.length > 0;
};

// Record a new import in the database
const recordImport = async (importData: {
  filename: string;
  supplierId: number;
  type: string;
  sourceData: any;
}): Promise<number> => {
  const [result] = await db.insert(imports)
    .values({
      filename: importData.filename,
      supplierId: importData.supplierId,
      status: 'pending',
      type: importData.type,
      sourceData: importData.sourceData,
      createdAt: new Date()
    })
    .returning({ id: imports.id });
    
  return result.id;
};

// Update import status in the database
const updateImportStatus = async (
  importId: number, 
  status: 'pending' | 'processing' | 'success' | 'error',
  data?: { 
    recordCount?: number;
    processedCount?: number;
    errorCount?: number;
    completedAt?: Date;
    importErrors?: any[];
  }
) => {
  await db.update(imports)
    .set({
      status: status,
      ...(data || {}),
      ...(status === 'success' || status === 'error' ? { completedAt: new Date() } : {})
    })
    .where(eq(imports.id, importId));
};

/**
 * Pull files from an FTP server
 */
const pullFromFTP = async (
  connectionId: number,
  credentials: FTPCredentials,
  supplierId: number,
  options: {
    skipExisting?: boolean;
    deleteAfterDownload?: boolean;
  } = {}
): Promise<IngestionResult> => {
  const result: IngestionResult = {
    success: false,
    message: '',
    filesPulled: [],
    filesSkipped: [],
    errors: []
  };
  
  return new Promise((resolve) => {
    const client = new FTP();
    
    // Set a timeout to avoid hanging connections
    const timeout = setTimeout(() => {
      client.destroy();
      result.message = 'Connection timed out';
      resolve(result);
    }, 30000); // 30 seconds timeout
    
    client.on('ready', async () => {
      clearTimeout(timeout);
      
      try {
        // List files in the remote directory
        const remoteDir = credentials.remoteDir || '/';
        client.list(remoteDir, async (err, list) => {
          if (err) {
            client.end();
            result.message = `Failed to list directory: ${err.message}`;
            result.errors.push(err);
            resolve(result);
            return;
          }
          
          // Filter files based on pattern
          const files = list.filter(item => 
            item.type === '-' && // Only files, not directories
            matchesPattern(item.name, credentials.filePattern)
          );
          
          if (files.length === 0) {
            client.end();
            result.success = true;
            result.message = 'No matching files found';
            resolve(result);
            return;
          }
          
          // Ensure uploads directory exists
          const localDir = path.join(getUploadsPath(), `supplier_${supplierId}`);
          await ensureLocalDir(localDir);
          
          // Download each file
          let successCount = 0;
          let errorCount = 0;
          
          // Process files sequentially to avoid overwhelming the FTP server
          for (const file of files) {
            const remoteFilePath = path.join(remoteDir, file.name).replace(/\\/g, '/');
            const localFilePath = path.join(localDir, file.name);
            
            // Check if this file was already imported
            if (options.skipExisting && await wasFileImported(file.name, supplierId)) {
              result.filesSkipped.push(file.name);
              continue;
            }
            
            try {
              // Create an import record
              const importId = await recordImport({
                filename: file.name,
                supplierId,
                type: file.name.endsWith('.csv') ? 'csv' : 
                      file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? 'excel' : 
                      file.name.endsWith('.json') ? 'json' : 'unknown',
                sourceData: {
                  connectionId,
                  remoteFilePath,
                  fileDetails: {
                    size: file.size,
                    date: file.date
                  }
                }
              });
              
              // Update status to processing
              await updateImportStatus(importId, 'processing');
              
              // Download the file
              await new Promise<void>((resolveDownload, rejectDownload) => {
                const writeStream = createWriteStream(localFilePath);
                
                client.get(remoteFilePath, (err, stream) => {
                  if (err) {
                    rejectDownload(err);
                    return;
                  }
                  
                  stream.pipe(writeStream);
                  
                  writeStream.on('close', async () => {
                    // File downloaded successfully
                    
                    // Delete file from server if requested
                    if (options.deleteAfterDownload) {
                      client.delete(remoteFilePath, (deleteErr) => {
                        if (deleteErr) {
                          console.warn(`Failed to delete file ${remoteFilePath}:`, deleteErr);
                        }
                      });
                    }
                    
                    // Update import status
                    await updateImportStatus(importId, 'success', {
                      completedAt: new Date()
                    });
                    
                    resolveDownload();
                  });
                  
                  writeStream.on('error', async (writeErr) => {
                    // Update import status to error
                    await updateImportStatus(importId, 'error', {
                      importErrors: [{ 
                        message: `Failed to write file: ${writeErr.message}`,
                        timestamp: new Date()
                      }]
                    });
                    
                    rejectDownload(writeErr);
                  });
                });
              });
              
              result.filesPulled.push(file.name);
              successCount++;
            } catch (error) {
              console.error(`Error downloading file ${remoteFilePath}:`, error);
              result.errors.push({
                file: file.name,
                error: error instanceof Error ? error.message : String(error)
              });
              errorCount++;
            }
          }
          
          client.end();
          
          result.success = successCount > 0;
          result.message = `Downloaded ${successCount} files, skipped ${result.filesSkipped.length}, failed ${errorCount}`;
          
          resolve(result);
        });
      } catch (error) {
        client.end();
        console.error('Error during FTP operations:', error);
        result.message = `Error during FTP operations: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(error);
        resolve(result);
      }
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      console.error('FTP connection error:', err);
      result.message = `FTP connection error: ${err.message}`;
      result.errors.push(err);
      resolve(result);
    });
    
    // Connect to the FTP server
    client.connect({
      host: credentials.host,
      port: credentials.port || 21,
      user: credentials.username,
      password: credentials.password,
      secure: credentials.secure || false
    });
  });
};

/**
 * Pull files from an SFTP server
 */
const pullFromSFTP = async (
  connectionId: number,
  credentials: FTPCredentials,
  supplierId: number,
  options: {
    skipExisting?: boolean;
    deleteAfterDownload?: boolean;
  } = {}
): Promise<IngestionResult> => {
  const result: IngestionResult = {
    success: false,
    message: '',
    filesPulled: [],
    filesSkipped: [],
    errors: []
  };
  
  return new Promise((resolve) => {
    const client = new SFTPClient();
    
    // Set a timeout to avoid hanging connections
    const timeout = setTimeout(() => {
      client.end();
      result.message = 'Connection timed out';
      resolve(result);
    }, 30000); // 30 seconds timeout
    
    client.on('ready', async () => {
      clearTimeout(timeout);
      
      try {
        // List files in the remote directory using SFTP
        client.sftp(async (err, sftp) => {
          if (err) {
            client.end();
            result.message = `Failed to start SFTP session: ${err.message}`;
            result.errors.push(err);
            resolve(result);
            return;
          }
          
          // Get directory listing
          const remoteDir = credentials.remoteDir || '.';
          sftp.readdir(remoteDir, async (err, list) => {
            if (err) {
              client.end();
              result.message = `Failed to list directory: ${err.message}`;
              result.errors.push(err);
              resolve(result);
              return;
            }
            
            // Filter files based on pattern (exclude directories)
            const files = list.filter(item => 
              item.attrs.isFile() && 
              matchesPattern(item.filename, credentials.filePattern)
            );
            
            if (files.length === 0) {
              client.end();
              result.success = true;
              result.message = 'No matching files found';
              resolve(result);
              return;
            }
            
            // Ensure uploads directory exists
            const localDir = path.join(getUploadsPath(), `supplier_${supplierId}`);
            await ensureLocalDir(localDir);
            
            // Download each file
            let successCount = 0;
            let errorCount = 0;
            
            // Process files sequentially
            for (const file of files) {
              const remoteFilePath = path.posix.join(remoteDir, file.filename);
              const localFilePath = path.join(localDir, file.filename);
              
              // Check if this file was already imported
              if (options.skipExisting && await wasFileImported(file.filename, supplierId)) {
                result.filesSkipped.push(file.filename);
                continue;
              }
              
              try {
                // Create an import record
                const importId = await recordImport({
                  filename: file.filename,
                  supplierId,
                  type: file.filename.endsWith('.csv') ? 'csv' : 
                        file.filename.endsWith('.xlsx') || file.filename.endsWith('.xls') ? 'excel' : 
                        file.filename.endsWith('.json') ? 'json' : 'unknown',
                  sourceData: {
                    connectionId,
                    remoteFilePath,
                    fileDetails: {
                      size: file.attrs.size,
                      accessTime: file.attrs.atime,
                      modifyTime: file.attrs.mtime
                    }
                  }
                });
                
                // Update status to processing
                await updateImportStatus(importId, 'processing');
                
                // Download the file
                await new Promise<void>((resolveDownload, rejectDownload) => {
                  sftp.fastGet(remoteFilePath, localFilePath, {}, async (err) => {
                    if (err) {
                      // Update import status to error
                      await updateImportStatus(importId, 'error', {
                        importErrors: [{ 
                          message: `Failed to download file: ${err.message}`,
                          timestamp: new Date()
                        }]
                      });
                      
                      rejectDownload(err);
                      return;
                    }
                    
                    // Delete file from server if requested
                    if (options.deleteAfterDownload) {
                      sftp.unlink(remoteFilePath, (unlinkErr) => {
                        if (unlinkErr) {
                          console.warn(`Failed to delete file ${remoteFilePath}:`, unlinkErr);
                        }
                      });
                    }
                    
                    // Update import status
                    await updateImportStatus(importId, 'success', {
                      completedAt: new Date()
                    });
                    
                    resolveDownload();
                  });
                });
                
                result.filesPulled.push(file.filename);
                successCount++;
              } catch (error) {
                console.error(`Error downloading file ${remoteFilePath}:`, error);
                result.errors.push({
                  file: file.filename,
                  error: error instanceof Error ? error.message : String(error)
                });
                errorCount++;
              }
            }
            
            client.end();
            
            result.success = successCount > 0;
            result.message = `Downloaded ${successCount} files, skipped ${result.filesSkipped.length}, failed ${errorCount}`;
            
            resolve(result);
          });
        });
      } catch (error) {
        client.end();
        console.error('Error during SFTP operations:', error);
        result.message = `Error during SFTP operations: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(error);
        resolve(result);
      }
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      console.error('SFTP connection error:', err);
      result.message = `SFTP connection error: ${err.message}`;
      result.errors.push(err);
      resolve(result);
    });
    
    // Connection options
    const connectConfig: any = {
      host: credentials.host,
      port: credentials.port || 22,
      username: credentials.username
    };
    
    // Authentication options
    if (credentials.privateKey) {
      connectConfig.privateKey = credentials.privateKey;
      if (credentials.passphrase) {
        connectConfig.passphrase = credentials.passphrase;
      }
    } else {
      connectConfig.password = credentials.password;
    }
    
    // Connect to the SFTP server
    client.connect(connectConfig);
  });
};

/**
 * Pull files from an FTP or SFTP server based on connection details
 */
export const pullFromFTPConnection = async (
  connectionId: number, 
  options: {
    skipExisting?: boolean;
    deleteAfterDownload?: boolean;
  } = {}
): Promise<IngestionResult> => {
  try {
    // Get connection details from database
    const connection = await db.select()
      .from(connections)
      .where(eq(connections.id, connectionId))
      .limit(1);
    
    if (connection.length === 0) {
      return {
        success: false,
        message: `Connection with ID ${connectionId} not found`,
        filesPulled: [],
        filesSkipped: [],
        errors: [{ message: 'Connection not found' }]
      };
    }
    
    const conn = connection[0];
    
    // Check if this is an FTP or SFTP connection
    if (conn.type !== 'ftp' && conn.type !== 'sftp') {
      return {
        success: false,
        message: `Connection type ${conn.type} is not supported for file ingestion`,
        filesPulled: [],
        filesSkipped: [],
        errors: [{ message: 'Unsupported connection type' }]
      };
    }
    
    // Check if supplier is specified
    if (!conn.supplierId) {
      return {
        success: false,
        message: 'Connection has no associated supplier',
        filesPulled: [],
        filesSkipped: [],
        errors: [{ message: 'No supplier associated with connection' }]
      };
    }
    
    // Pull files based on connection type
    if (conn.type === 'ftp') {
      return await pullFromFTP(connectionId, conn.credentials as FTPCredentials, conn.supplierId, options);
    } else { // sftp
      return await pullFromSFTP(connectionId, conn.credentials as FTPCredentials, conn.supplierId, options);
    }
  } catch (error) {
    console.error('Error in pullFromFTPConnection:', error);
    return {
      success: false,
      message: `Failed to pull files: ${error instanceof Error ? error.message : String(error)}`,
      filesPulled: [],
      filesSkipped: [],
      errors: [error]
    };
  }
};

/**
 * Get all active FTP/SFTP connections
 */
export const getActiveFTPConnections = async (): Promise<{ id: number; type: 'ftp' | 'sftp'; supplierId: number }[]> => {
  const activeConnections = await db.select({
    id: connections.id,
    type: connections.type,
    supplierId: connections.supplierId
  })
  .from(connections)
  .where(eq(connections.isActive, true));
  
  // Filter to only FTP/SFTP connections that have a supplier ID
  return activeConnections.filter(
    conn => (conn.type === 'ftp' || conn.type === 'sftp') && conn.supplierId !== null
  ) as { id: number; type: 'ftp' | 'sftp'; supplierId: number }[];
};

/**
 * Get import status for a list of files
 */
export const getImportStatus = async (filenames: string[]): Promise<Record<string, 'pending' | 'processing' | 'success' | 'error'>> => {
  if (filenames.length === 0) return {};
  
  const statuses = await db.select({
    filename: imports.filename,
    status: imports.status
  })
  .from(imports)
  .where(inArray(imports.filename, filenames));
  
  // Convert to a record for easy lookup
  const result: Record<string, 'pending' | 'processing' | 'success' | 'error'> = {};
  
  // Safely add statuses to the result object
  for (const stat of statuses) {
    if (stat.filename && typeof stat.filename === 'string' && stat.status) {
      // Default to pending if status is null
      const status = stat.status || 'pending';
      result[stat.filename] = status as 'pending' | 'processing' | 'success' | 'error';
    }
  }
  
  return result;
};

/**
 * Get remote paths from an SFTP/FTP server
 * @param credentials FTP/SFTP connection credentials
 * @returns List of files and directories
 */
export const getRemotePaths = async (
  credentials: FTPCredentials
): Promise<{
  success: boolean;
  message: string;
  paths?: string[];
  error?: any;
}> => {
  const result = {
    success: false,
    message: '',
    paths: [] as string[],
    error: null as any
  };

  // Default remote directory to root if not specified
  const remoteDir = credentials.remoteDir || '/';
  
  // Determine if SFTP or FTP based on port/secure flag
  const isSFTP = credentials.port === 22 || credentials.privateKey;
  
  if (isSFTP) {
    // Use SFTP protocol
    return new Promise((resolve) => {
      const conn = new SFTPClient();
      
      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            result.success = false;
            result.message = `SFTP error: ${err.message}`;
            result.error = err;
            conn.end();
            resolve(result);
            return;
          }
          
          // List directories recursively up to 2 levels deep
          const explorePath = async (currentPath: string, depth: number = 0) => {
            if (depth > 2) return; // Limit recursion depth
            
            try {
              const list = await new Promise<any[]>((pathResolve, pathReject) => {
                sftp.readdir(currentPath, (dirErr, dirList) => {
                  if (dirErr) pathReject(dirErr);
                  else pathResolve(dirList || []);
                });
              });
              
              // Add the current path
              result.paths.push(currentPath);
              
              // Process directories only for recursive listing
              const directories = list.filter(item => item.longname.startsWith('d'));
              
              for (const dir of directories) {
                const newPath = `${currentPath}${currentPath.endsWith('/') ? '' : '/'}${dir.filename}`;
                await explorePath(newPath, depth + 1);
              }
            } catch (pathErr) {
              console.error(`Error exploring path ${currentPath}:`, pathErr);
            }
          };
          
          // Start exploring from the remote directory
          explorePath(remoteDir)
            .then(() => {
              result.success = true;
              result.message = 'Successfully retrieved remote paths';
              conn.end();
              resolve(result);
            })
            .catch((explorationErr) => {
              result.success = false;
              result.message = `Error exploring SFTP paths: ${explorationErr.message}`;
              result.error = explorationErr;
              conn.end();
              resolve(result);
            });
        });
      });
      
      conn.on('error', (err) => {
        result.success = false;
        result.message = `SFTP connection error: ${err.message}`;
        result.error = err;
        resolve(result);
      });
      
      // Connect using the provided credentials
      const connectOptions: any = {
        host: credentials.host,
        port: credentials.port || 22,
        username: credentials.username,
      };
      
      if (credentials.password) {
        connectOptions.password = credentials.password;
      } else if (credentials.privateKey) {
        connectOptions.privateKey = credentials.privateKey;
        if (credentials.passphrase) {
          connectOptions.passphrase = credentials.passphrase;
        }
      }
      
      conn.connect(connectOptions);
    });
  } else {
    // Use FTP protocol
    return new Promise((resolve) => {
      const client = new FTP();
      
      client.on('ready', () => {
        const exploredPaths = new Set<string>();
        
        // Function to explore a directory
        const explorePath = async (currentPath: string, depth: number = 0) => {
          if (depth > 2) return; // Limit recursion depth
          if (exploredPaths.has(currentPath)) return; // Avoid duplicate exploration
          
          exploredPaths.add(currentPath);
          
          try {
            const list = await new Promise<any[]>((pathResolve, pathReject) => {
              client.list(currentPath, (listErr, listResult) => {
                if (listErr) pathReject(listErr);
                else pathResolve(listResult || []);
              });
            });
            
            // Add the current path
            result.paths.push(currentPath);
            
            // Process directories for recursive listing
            const directories = list.filter(item => item.type === 'd');
            
            for (const dir of directories) {
              const newPath = `${currentPath}${currentPath.endsWith('/') ? '' : '/'}${dir.name}`;
              await explorePath(newPath, depth + 1);
            }
          } catch (pathErr) {
            console.error(`Error exploring FTP path ${currentPath}:`, pathErr);
          }
        };
        
        // Start exploring from the remote directory
        explorePath(remoteDir)
          .then(() => {
            result.success = true;
            result.message = 'Successfully retrieved remote paths';
            client.end();
            resolve(result);
          })
          .catch((explorationErr) => {
            result.success = false;
            result.message = `Error exploring FTP paths: ${explorationErr.message}`;
            result.error = explorationErr;
            client.end();
            resolve(result);
          });
      });
      
      client.on('error', (err) => {
        result.success = false;
        result.message = `FTP connection error: ${err.message}`;
        result.error = err;
        resolve(result);
      });
      
      // Connect using the provided credentials
      client.connect({
        host: credentials.host,
        port: credentials.port || 21,
        user: credentials.username,
        password: credentials.password,
        secure: credentials.secure || false
      });
    });
  }
};