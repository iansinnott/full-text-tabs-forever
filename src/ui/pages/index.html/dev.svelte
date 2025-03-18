<script lang="ts">
  // Configuration options
  const FILE_SIZE_MB = 200; // File size in MB
  const CHUNK_SIZE_KB = 64; // Chunk size in KB
  const FILE_SIZE_BYTES = FILE_SIZE_MB * 1024 * 1024;
  const CHUNK_SIZE_BYTES = CHUNK_SIZE_KB * 1024;

  async function saveTextFile() {
    try {
      // @ts-ignore
      const fileHandle = await window.showSaveFilePicker({
        _preferPolyfill: false,
        suggestedName: "Untitled.txt",
        types: [{ accept: { "text/plain": [".txt"] } }],
        excludeAcceptAllOption: false,
      });

      // Look at what extension they chosen
      const extensionChosen = fileHandle.name.split(".").pop();

      const textContent = `Hello! This is a text file saved with extension .${extensionChosen}`;
      const encoder = new TextEncoder();
      const blob = new Blob([encoder.encode(textContent)], {
        type: "text/plain",
      });

      // Using writer methods
      const writer = await fileHandle.createWritable();
      await writer.write(blob);
      await writer.close();
    } catch (error) {
      console.error("Error picking or saving file:", error);
    }
  }

  async function saveLargeFile() {
    try {
      // @ts-ignore
      const fileHandle = await window.showSaveFilePicker({
        _preferPolyfill: false,
        suggestedName: `large-file-${FILE_SIZE_MB}MB.bin`,
        types: [{ accept: { "application/octet-stream": [".bin"] } }],
        excludeAcceptAllOption: false,
      });

      // Create a writable stream
      const writableStream = await fileHandle.createWritable();

      // Create a TransformStream to generate data
      const { readable, writable } = new TransformStream();

      // Start the stream piping
      readable.pipeTo(writableStream).catch((error) => {
        console.error("Streaming error:", error);
      });

      // Write data in chunks to avoid memory issues
      const writer = writable.getWriter();
      const numChunks = Math.ceil(FILE_SIZE_BYTES / CHUNK_SIZE_BYTES);
      let bytesWritten = 0;

      // Generate dummy data in chunks
      for (let i = 0; i < numChunks; i++) {
        // Create a chunk of dummy data
        const currentChunkSize =
          i < numChunks - 1 ? CHUNK_SIZE_BYTES : FILE_SIZE_BYTES - bytesWritten;

        const chunk = new Uint8Array(currentChunkSize);

        // Fill with random-ish data (pattern based on chunk number)
        for (let j = 0; j < chunk.length; j++) {
          chunk[j] = (i + j) % 256;
        }

        // Write the chunk and flush
        await writer.write(chunk);

        // Update bytes written
        bytesWritten += currentChunkSize;
      }

      // Close the writer to signal we're done
      await writer.close();

      console.log(`${FILE_SIZE_MB}MB file saved successfully!`);
    } catch (error) {
      console.error("Error saving large file:", error);
    }
  }
</script>

<div class="p-4">
  <h1 class="text-2xl font-bold mb-4">Development Page</h1>
  <p class="mb-4">This is a blank development page. Content will be added later.</p>

  <div class="flex space-x-4 mb-6">
    <button
      on:click={saveTextFile}
      class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
    >
      Pick File
    </button>

    <button
      on:click={saveLargeFile}
      class="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded"
    >
      Save {FILE_SIZE_MB}MB File
    </button>
  </div>

  <div class="mt-4">
    <p class="text-sm text-gray-600">
      Open browser console (F12) to see log messages during file operations.
    </p>
  </div>
</div>
