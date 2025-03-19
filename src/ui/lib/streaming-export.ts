import { rpc } from './rpc';

// Polyfill for browsers that don't support the File System Access API
// This is a simplified version; for production, consider using a more robust library
const getFileSystemAccessPolyfill = () => {
  return {
    showSaveFilePicker: async (options: any) => {
      throw new Error('File System Access API not supported in this browser');
    }
  };
};

// Check if File System Access API is supported
const isFileSystemAccessSupported = () => {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
};

interface FileSystemAccessAPI {
  showSaveFilePicker: (options: any) => Promise<any>;
}

// Get the File System Access API or a polyfill
const getFileSystemAccess = (): FileSystemAccessAPI => {
  if (isFileSystemAccessSupported()) {
    // We've already checked that showSaveFilePicker exists on window
    return window as any as FileSystemAccessAPI;
  }
  return getFileSystemAccessPolyfill();
};

/**
 * Stream export documents to a file
 * @param options Configuration options
 * @returns Promise that resolves when export is complete
 */
export const streamingExport = async (options: {
  batchSize?: number,
  onProgress?: (progress: { current: number, total: number }) => void,
}) => {
  const { batchSize = 100, onProgress } = options;
  
  // Get database stats to estimate workload
  const stats = await rpc(['getStats']) as {
    document: { count: number };
    document_fragment: { count: number };
    db: { size_bytes: number };
  };
  
  // Update progress with initial values
  if (onProgress) {
    onProgress({ current: 0, total: stats.document.count });
  }
  
  // Check if File System Access API is supported
  if (!isFileSystemAccessSupported()) {
    console.log('File System Access API not supported, falling back to regular export');
    // Fall back to the existing exportJson function
    return rpc(['exportJson']);
  }
  
  try {
    // Use File System Access API to get a file handle
    const fileHandle = await getFileSystemAccess().showSaveFilePicker({
      suggestedName: `fttf-${Date.now()}.json`,
      types: [{ 
        description: 'JSON Files',
        accept: { 'application/json': ['.json'] } 
      }],
      excludeAcceptAllOption: false,
    });
    
    // Create a writable stream
    const writableStream = await fileHandle.createWritable();
    
    // Write the opening of the JSON
    const encoder = new TextEncoder();
    await writableStream.write(encoder.encode('{"document":['));
    
    // Get total count for progress reporting
    const totalDocs = stats.document.count;
    let processedCount = 0;
    let isFirstBatch = true;
    
    // Process in batches
    while (processedCount < totalDocs) {
      // Fetch a batch of documents
      const batch = await rpc(['getDocumentBatch', { 
        offset: processedCount, 
        limit: batchSize 
      }]);
      
      if (!batch || !batch.rows || batch.rows.length === 0) {
        break;
      }
      
      // Convert batch to JSON string
      let batchJson = '';
      
      for (let i = 0; i < batch.rows.length; i++) {
        // Add comma separator between batches, but not before the first one
        if (i === 0 && !isFirstBatch) {
          batchJson += ',';
        } else if (i > 0) {
          batchJson += ',';
        }
        
        batchJson += JSON.stringify(batch.rows[i]);
      }
      
      // Write batch to file
      await writableStream.write(encoder.encode(batchJson));
      
      // Update progress
      processedCount += batch.rows.length;
      isFirstBatch = false;
      
      if (onProgress) {
        onProgress({ current: processedCount, total: totalDocs });
      }
    }
    
    // Write the closing of the JSON
    await writableStream.write(encoder.encode(']}'));
    
    // Close the stream
    await writableStream.close();
    
    return { success: true };
  } catch (error) {
    console.error('Error during streaming export:', error);
    
    // If there was an error with the File System API, fall back to the regular export
    if (error.name === 'NotSupportedError' || error.message.includes('not supported')) {
      console.log('Falling back to regular export method');
      return rpc(['exportJson']);
    }
    
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error during export' 
    };
  }
};