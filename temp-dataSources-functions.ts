// New test SFTP connection function
const testSftpConnection = async (event: React.MouseEvent) => {
  event.preventDefault();
  setIsTestingConnection(true);
  setTestConnectionResult(null);
  
  // Get all SFTP-related form fields
  const hostElement = document.getElementById('sftp-host') as HTMLInputElement;
  const portElement = document.getElementById('sftp-port') as HTMLInputElement;
  const usernameElement = document.getElementById('sftp-username') as HTMLInputElement;
  const passwordElement = document.getElementById('sftp-password') as HTMLInputElement;
  const privateKeyElement = document.getElementById('sftp-private-key') as HTMLTextAreaElement;
  
  // Validate basic connection info
  if (!hostElement?.value || !usernameElement?.value) {
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "Host and username are required"
    });
    setIsTestingConnection(false);
    return;
  }
  
  // Validate remote paths
  if (remotePaths.length === 0) {
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "At least one remote path is required"
    });
    setIsTestingConnection(false);
    return;
  }
  
  // Check that all paths have valid values
  const invalidPaths = remotePaths.filter(p => !p.label || !p.path || !p.path.startsWith('/'));
  if (invalidPaths.length > 0) {
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "All remote paths must have labels and start with /"
    });
    setIsTestingConnection(false);
    return;
  }
  
  const usesPrivateKey = requiresPrivateKey;
  if (usesPrivateKey && !privateKeyElement?.value) {
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "Private key is required when using key authentication"
    });
    setIsTestingConnection(false);
    return;
  }
  
  if (!usesPrivateKey && !passwordElement?.value) {
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "Password is required"
    });
    setIsTestingConnection(false);
    return;
  }
  
  // Build credentials object
  const credentials = {
    host: hostElement.value,
    port: portElement.value ? parseInt(portElement.value, 10) : 22,
    username: usernameElement.value,
    remote_paths: remotePaths,
    ...(usesPrivateKey 
      ? { privateKey: privateKeyElement.value }
      : { password: passwordElement.value }
    )
  };
  
  try {
    const result = await apiRequest('/api/connections/test', 'POST', {
      type: 'sftp',
      credentials
    });
    
    setTestConnectionResult(result);
    
    if (result.success) {
      toast({
        title: "Connection Successful",
        description: "Successfully connected to SFTP server"
      });
    } else {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: result.message || "Could not connect to SFTP server"
      });
    }
  } catch (error) {
    console.error('Test connection error:', error);
    toast({
      variant: "destructive",
      title: "Connection Error",
      description: "An unexpected error occurred while testing the connection"
    });
  } finally {
    setIsTestingConnection(false);
  }
};

// New test SFTP connection edit function
const testSftpConnectionEdit = async (event: React.MouseEvent) => {
  event.preventDefault();
  setIsTestingConnection(true);
  setTestConnectionResult(null);
  
  // Get all SFTP-related form fields
  const hostElement = document.getElementById('edit-sftp-host') as HTMLInputElement;
  const portElement = document.getElementById('edit-sftp-port') as HTMLInputElement;
  const usernameElement = document.getElementById('edit-sftp-username') as HTMLInputElement;
  const passwordElement = document.getElementById('edit-sftp-password') as HTMLInputElement;
  const privateKeyElement = document.getElementById('edit-sftp-private-key') as HTMLTextAreaElement;
  
  // Validate basic connection info
  if (!hostElement?.value || !usernameElement?.value) {
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "Host and username are required"
    });
    setIsTestingConnection(false);
    return;
  }
  
  // Validate remote paths
  if (editRemotePaths.length === 0) {
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "At least one remote path is required"
    });
    setIsTestingConnection(false);
    return;
  }
  
  // Check that all paths have valid values
  const invalidPaths = editRemotePaths.filter(p => !p.label || !p.path || !p.path.startsWith('/'));
  if (invalidPaths.length > 0) {
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "All remote paths must have labels and start with /"
    });
    setIsTestingConnection(false);
    return;
  }
  
  const usesPrivateKey = editRequiresPrivateKey;
  if (usesPrivateKey && !privateKeyElement?.value) {
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "Private key is required when using key authentication"
    });
    setIsTestingConnection(false);
    return;
  }
  
  if (!usesPrivateKey && !passwordElement?.value) {
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "Password is required"
    });
    setIsTestingConnection(false);
    return;
  }
  
  // Build credentials object
  const credentials = {
    host: hostElement.value,
    port: portElement.value ? parseInt(portElement.value, 10) : 22,
    username: usernameElement.value,
    remote_paths: editRemotePaths,
    ...(usesPrivateKey 
      ? { privateKey: privateKeyElement.value }
      : { password: passwordElement.value }
    )
  };
  
  try {
    const result = await apiRequest('/api/connections/test', 'POST', {
      type: 'sftp',
      credentials
    });
    
    setTestConnectionResult(result);
    
    if (result.success) {
      toast({
        title: "Connection Successful",
        description: "Successfully connected to SFTP server"
      });
    } else {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: result.message || "Could not connect to SFTP server"
      });
    }
  } catch (error) {
    console.error('Test connection error:', error);
    toast({
      variant: "destructive",
      title: "Connection Error",
      description: "An unexpected error occurred while testing the connection"
    });
  } finally {
    setIsTestingConnection(false);
  }
};