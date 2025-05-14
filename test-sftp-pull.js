// Simple script to test SFTP sample data pull
const { Client: SFTPClient } = require('ssh2');

async function testSFTPSampleData() {
  return new Promise((resolve) => {
    const client = new SFTPClient();
    
    // Set a timeout to avoid hanging connections
    const timeout = setTimeout(() => {
      client.end();
      console.log('Connection timed out');
      resolve(false);
    }, 30000); // 30 seconds timeout
    
    // Prepare connection config using environment variables
    const connectConfig = {
      host: 'edi.cwrdistribution.com',
      port: 22,
      username: 'eco8',
      password: process.env.SFTP_PASSWORD
    };
    
    console.log('Connecting to SFTP server...');
    
    client.on('ready', () => {
      clearTimeout(timeout);
      console.log('Connected to SFTP server!');
      
      // Start SFTP session
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          console.error('SFTP session error:', err.message);
          resolve(false);
          return;
        }
        
        console.log('SFTP session started successfully');
        
        // Try to access the sample file path
        const remotePath = '/eco8/out/catalog.csv';
        console.log(`Checking if ${remotePath} exists...`);
        
        sftp.stat(remotePath, (statErr, stats) => {
          if (statErr) {
            console.error(`Cannot access path ${remotePath}:`, statErr.message);
            client.end();
            resolve(false);
            return;
          }
          
          if (stats.isFile()) {
            console.log(`${remotePath} is a file with size ${stats.size} bytes`);
            
            // Read a small sample of the file
            const stream = sftp.createReadStream(remotePath, { start: 0, end: 500 });
            const chunks = [];
            
            stream.on('data', (chunk) => {
              chunks.push(chunk);
            });
            
            stream.on('end', () => {
              const content = Buffer.concat(chunks).toString('utf8');
              console.log('Sample file content:', content.substring(0, 200) + '...');
              client.end();
              resolve(true);
            });
            
            stream.on('error', (streamErr) => {
              console.error('Error reading file:', streamErr.message);
              client.end();
              resolve(false);
            });
          } else {
            console.log(`${remotePath} is a directory`);
            client.end();
            resolve(false);
          }
        });
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      console.error('SFTP connection error:', err.message);
      client.end();
      resolve(false);
    });
    
    client.connect(connectConfig);
  });
}

// Run the test
testSFTPSampleData().then(success => {
  console.log('Test completed with result:', success ? 'SUCCESS' : 'FAILURE');
});