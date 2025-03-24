<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import Modal from "./Modal.svelte";
  import { rpc } from "./lib/rpc";

  export let open = false;

  let isImporting = false;
  let isMigrated = false;
  let vlcnImportMessage = "";
  let migrationProgress = 0;
  let totalDocuments = 0;
  let showMigrationUI = false;

  // Define message listener function
  const handleMessage = (message) => {
    if (message.type === "vlcnMigrationStatus") {
      console.log("Migration status update:", message);

      if (message.status === "starting" || message.status === "fetching") {
        vlcnImportMessage = message.message;
      } else if (message.status === "importing") {
        totalDocuments = message.total;
        migrationProgress = message.current;
        vlcnImportMessage = message.message;
      } else if (message.status === "progress") {
        migrationProgress = message.current;
        vlcnImportMessage = `Imported ${message.current} of ${message.total} documents...`;
      } else if (message.status === "complete") {
        isImporting = false;
        vlcnImportMessage = message.message;
        migrationProgress = totalDocuments;
        showMigrationUI = false; // Hide the modal when complete
      } else if (message.status === "error") {
        isImporting = false;
        vlcnImportMessage = message.message;
      } else if (message.status === "empty") {
        isImporting = false;
        vlcnImportMessage = message.message;
      }
    }
    return true;
  };

  // Setup and tear down listener
  const setupMigrationListener = () => {
    chrome.runtime.onMessage.addListener(handleMessage);
  };

  const removeMigrationListener = () => {
    chrome.runtime.onMessage.removeListener(handleMessage);
  };

  onMount(async () => {
    setupMigrationListener();
    await checkVLCNMigrationStatus();
  });

  onDestroy(() => {
    removeMigrationListener();
  });

  // Reset state when reused
  const resetState = () => {
    isImporting = false;
    migrationProgress = 0;
    totalDocuments = 0;
    vlcnImportMessage = "";
  };

  // Watch for open prop changes to refresh data
  $: if (open) {
    checkVLCNMigrationStatus();
  }

  const checkVLCNMigrationStatus = async () => {
    // Reset the state to prevent flashing old data
    resetState();

    try {
      // First, check if the VLCN backend is available and has been migrated
      const response = await rpc(["checkVLCNMigrationStatus"]);
      if (response?.migrated) {
        isMigrated = true;
        vlcnImportMessage = "VLCN database has already been migrated to PgLite.";
        showMigrationUI = false;
      } else if (response?.available) {
        showMigrationUI = true;
        isMigrated = false;
        vlcnImportMessage = `Found ${response.documentCount} documents to migrate from VLCN database.`;
      } else {
        showMigrationUI = false;
        vlcnImportMessage = "No VLCN database found. If you're a new user, you can ignore this.";
      }
    } catch (error) {
      console.error("Error checking VLCN migration status", error);
      showMigrationUI = false;
    }
  };

  const importVLCNDatabase = async () => {
    isImporting = true;
    migrationProgress = 0;
    vlcnImportMessage = "Initializing VLCN database migration...";
    try {
      await rpc(["importVLCNDocumentsV1"]);
      // Status updates will come through the listener
      // When complete, the message listener will set showMigrationUI to false
      // and we'll let the parent component know
      // setTimeout(() => {
      //   window.location.reload();
      // }, 1000); // Give a slight delay to show success message before closing
    } catch (error) {
      isImporting = false;
      vlcnImportMessage = `Error importing VLCN database: ${error.message}`;
    }
  };
</script>

<Modal
  open={open && showMigrationUI && !isMigrated}
  title="Database Migration Available"
  wideContent={false}
  on:close
>
  <div class="text-sm text-slate-300">
    <p class="mb-4">
      We detected data from a previous version of Full Text Tabs Forever. Would you like to migrate
      your search index to the new version?
    </p>
    <p class="mb-4">
      The import process may take several minutes depending on the size of your database.
    </p>
    <div class="mt-4">
      <button
        on:click={importVLCNDatabase}
        class="bg-pink-800 text-white py-2 px-4 rounded hover:bg-pink-900 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isImporting || isMigrated}
      >
        {#if isImporting}
          Importing...
        {:else if isMigrated}
          Already Migrated
        {:else}
          Import VLCN Database
        {/if}
      </button>
    </div>
    {#if vlcnImportMessage}
      <div class="mt-4">
        <p
          class:text-green-500={vlcnImportMessage.includes("successfully") ||
            vlcnImportMessage.includes("complete")}
          class:text-red-500={vlcnImportMessage.includes("Error") ||
            vlcnImportMessage.includes("failed")}
          class:text-yellow-500={vlcnImportMessage.includes("already been migrated")}
        >
          {vlcnImportMessage}
        </p>

        {#if isImporting && totalDocuments > 0}
          <div class="mt-2">
            <div class="w-full bg-gray-700 rounded-full h-2.5 mb-2">
              <div
                class="bg-pink-800 h-2.5 rounded-full"
                style="width: {(migrationProgress / totalDocuments) * 100}%"
              ></div>
            </div>
            <p class="text-xs text-gray-400 text-right">
              {migrationProgress} of {totalDocuments} documents
            </p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</Modal>
