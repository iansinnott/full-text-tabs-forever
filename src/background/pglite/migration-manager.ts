import { PGlite } from "./HAX_pglite";
import { Transaction } from "@electric-sql/pglite";

/**
 * Simple migration interface for defining database schema changes
 * with forward-only migrations
 */
export interface Migration {
  version: number;
  name: string;
  description: string;
  sql: string;  // SQL to execute for this migration
}

/**
 * Migration status
 */
export interface MigrationStatus {
  ok: boolean;
  currentVersion: number;
  availableVersion: number;
  pendingCount: number;
}

/**
 * A simple, forward-only migration manager for PGlite
 */
export class MigrationManager {
  private db: PGlite;
  private migrations: Migration[] = [];
  private currentVersion = 0;
  private highestVersion = 0;

  constructor(db: PGlite) {
    this.db = db;
  }

  /**
   * Register a migration with the manager
   */
  registerMigration(migration: Migration): void {
    this.migrations.push(migration);
    
    // Update highest available version
    this.highestVersion = Math.max(this.highestVersion, migration.version);
    
    // Sort migrations by version
    this.migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Check if a table exists
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.db.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = $1) as exists",
        [tableName]
      );
      return result.rows[0]?.exists || false;
    } catch (error) {
      // If this fails, assume table doesn't exist
      console.warn(`Error checking if table ${tableName} exists:`, error);
      return false;
    }
  }

  /**
   * Get current migration version from the database
   */
  private async getCurrentVersion(): Promise<number> {
    try {
      const migrationsTableExists = await this.checkTableExists('migrations');
      
      if (!migrationsTableExists) {
        return 0; // No migrations applied yet
      }
      
      const result = await this.db.query<{ max_version: number }>(
        "SELECT MAX(version) as max_version FROM migrations"
      );
      
      return result.rows[0]?.max_version || 0;
    } catch (error) {
      console.error("Error getting current migration version:", error);
      return 0;
    }
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<boolean> {
    try {
      console.debug(`Applying migration ${migration.name} (v${migration.version})...`);
      
      const startTime = performance.now();
      
      await this.db.transaction(async (tx) => {
        // Execute migration SQL
        await tx.exec(migration.sql);
        
        // Record migration in the migrations table
        await tx.query(
          "INSERT INTO migrations (version, name, description, applied_at) VALUES ($1, $2, $3, $4)",
          [migration.version, migration.name, migration.description, Date.now()]
        );
      });
      
      const duration = Math.round(performance.now() - startTime);
      console.debug(`Migration ${migration.name} (v${migration.version}) applied successfully in ${duration}ms`);
      
      return true;
    } catch (error) {
      console.error(`Error applying migration ${migration.name} (v${migration.version}):`, error);
      return false;
    }
  }

  /**
   * Apply all pending migrations
   */
  async applyMigrations(): Promise<MigrationStatus> {
    try {
      // Ensure migrations table exists
      const migrationsTableExists = await this.checkTableExists('migrations');
      
      if (!migrationsTableExists) {
        // Create migrations table if it doesn't exist
        await this.db.exec(`
          CREATE TABLE IF NOT EXISTS migrations (
            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            version INTEGER UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            applied_at BIGINT NOT NULL
          );
        `);
      }
      
      // Check if the migrations table has the required columns
      try {
        await this.db.query("SELECT name FROM migrations LIMIT 0");
      } catch (error) {
        console.warn("Migrations table exists but may be missing columns. Attempting to upgrade schema...");
        // Add missing columns if they don't exist
        try {
          await this.db.exec("ALTER TABLE migrations ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'legacy_migration'");
          await this.db.exec("ALTER TABLE migrations ADD COLUMN IF NOT EXISTS description TEXT");
          console.debug("Successfully upgraded migrations table schema");
        } catch (alterError) {
          console.error("Failed to alter migrations table:", alterError);
          throw alterError;
        }
      }
      
      // Get current version
      this.currentVersion = await this.getCurrentVersion();
      console.debug(`Current migration version: ${this.currentVersion}`);
      
      // Find pending migrations
      const pendingMigrations = this.migrations.filter(m => m.version > this.currentVersion);
      console.debug(`Found ${pendingMigrations.length} pending migrations`);
      
      if (pendingMigrations.length === 0) {
        return {
          ok: true,
          currentVersion: this.currentVersion,
          availableVersion: this.highestVersion,
          pendingCount: 0
        };
      }
      
      // Apply migrations in order
      for (const migration of pendingMigrations) {
        const success = await this.applyMigration(migration);
        
        if (!success) {
          return {
            ok: false,
            currentVersion: this.currentVersion,
            availableVersion: this.highestVersion,
            pendingCount: pendingMigrations.length
          };
        }
        
        this.currentVersion = migration.version;
      }
      
      return {
        ok: true,
        currentVersion: this.currentVersion,
        availableVersion: this.highestVersion,
        pendingCount: 0
      };
    } catch (error) {
      console.error("Error applying migrations:", error);
      
      return {
        ok: false,
        currentVersion: this.currentVersion,
        availableVersion: this.highestVersion,
        pendingCount: this.migrations.filter(m => m.version > this.currentVersion).length
      };
    }
  }
}