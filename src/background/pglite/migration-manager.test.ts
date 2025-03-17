import { describe, it, expect, beforeEach, mock } from "bun:test";
import { PGlite } from "@electric-sql/pglite";  // Use the direct import for testing
import { MigrationManager, Migration } from "./migration-manager";

describe("MigrationManager", () => {
  let db: PGlite;
  let migrationManager: MigrationManager;
  
  beforeEach(async () => {
    // Create a new in-memory database for each test
    db = new PGlite();
    migrationManager = new MigrationManager(db);
  });
  
  it("should initialize with no migrations", async () => {
    const status = await migrationManager.applyMigrations();
    
    expect(status.ok).toBe(true);
    expect(status.currentVersion).toBe(0);
    expect(status.availableVersion).toBe(0);
    expect(status.pendingCount).toBe(0);
  });
  
  it("should register migrations correctly", () => {
    const migration1: Migration = {
      version: 1,
      name: "test_migration_1",
      description: "Test migration 1",
      sql: "CREATE TABLE test1 (id SERIAL PRIMARY KEY);"
    };
    
    const migration2: Migration = {
      version: 2,
      name: "test_migration_2",
      description: "Test migration 2",
      sql: "CREATE TABLE test2 (id SERIAL PRIMARY KEY);"
    };
    
    migrationManager.registerMigration(migration1);
    migrationManager.registerMigration(migration2);
    
    // We're testing internal state here, so we need to cast to access private properties
    const migrations = (migrationManager as any).migrations;
    expect(migrations.length).toBe(2);
    expect(migrations[0].version).toBe(1);
    expect(migrations[1].version).toBe(2);
  });
  
  it("should apply migrations in order", async () => {
    const migration1: Migration = {
      version: 1,
      name: "test_migration_1",
      description: "Test migration 1",
      sql: "CREATE TABLE test1 (id SERIAL PRIMARY KEY);"
    };
    
    const migration2: Migration = {
      version: 2,
      name: "test_migration_2",
      description: "Test migration 2",
      sql: "CREATE TABLE test2 (id SERIAL PRIMARY KEY);"
    };
    
    migrationManager.registerMigration(migration1);
    migrationManager.registerMigration(migration2);
    
    const status = await migrationManager.applyMigrations();
    
    expect(status.ok).toBe(true);
    expect(status.currentVersion).toBe(2);
    expect(status.availableVersion).toBe(2);
    expect(status.pendingCount).toBe(0);
    
    // Verify tables were created
    const result1 = await db.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'test1'");
    const result2 = await db.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'test2'");
    
    expect(result1.rows.length).toBe(1);
    expect(result2.rows.length).toBe(1);
  });
  
  it("should only apply pending migrations", async () => {
    // First migration
    const migration1: Migration = {
      version: 1,
      name: "test_migration_1",
      description: "Test migration 1",
      sql: "CREATE TABLE test1 (id SERIAL PRIMARY KEY);"
    };
    
    migrationManager.registerMigration(migration1);
    await migrationManager.applyMigrations();
    
    // Second migration
    const migration2: Migration = {
      version: 2,
      name: "test_migration_2",
      description: "Test migration 2",
      sql: "CREATE TABLE test2 (id SERIAL PRIMARY KEY);"
    };
    
    migrationManager.registerMigration(migration2);
    const status = await migrationManager.applyMigrations();
    
    expect(status.ok).toBe(true);
    expect(status.currentVersion).toBe(2);
    
    // Verify the migrations table has 2 records
    const migrationsResult = await db.query<{version: number}>("SELECT * FROM migrations ORDER BY version");
    expect(migrationsResult.rows.length).toBe(2);
    expect(migrationsResult.rows[0].version).toBe(1);
    expect(migrationsResult.rows[1].version).toBe(2);
  });
  
  it("should handle errors in migrations", async () => {
    const migration1: Migration = {
      version: 1,
      name: "test_migration_1",
      description: "Test migration 1",
      sql: "CREATE TABLE test1 (id SERIAL PRIMARY KEY);"
    };
    
    // This migration has invalid SQL
    const migration2: Migration = {
      version: 2,
      name: "invalid_migration",
      description: "Invalid SQL migration",
      sql: "CREATE TABLE WITH INVALID SYNTAX!!!"
    };
    
    migrationManager.registerMigration(migration1);
    migrationManager.registerMigration(migration2);
    
    const status = await migrationManager.applyMigrations();
    
    expect(status.ok).toBe(false);
    expect(status.currentVersion).toBe(1); // Only the first migration should be applied
    
    // Verify only the first table exists
    const result1 = await db.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'test1'");
    const result2 = await db.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'test2'");
    
    expect(result1.rows.length).toBe(1);
    expect(result2.rows.length).toBe(0);
  });
  
  it("should handle migrations with out-of-order versions", async () => {
    const migration2: Migration = {
      version: 2,
      name: "test_migration_2",
      description: "Test migration 2",
      sql: "CREATE TABLE test2 (id SERIAL PRIMARY KEY);"
    };
    
    const migration1: Migration = {
      version: 1,
      name: "test_migration_1",
      description: "Test migration 1",
      sql: "CREATE TABLE test1 (id SERIAL PRIMARY KEY);"
    };
    
    // Register in reverse order
    migrationManager.registerMigration(migration2);
    migrationManager.registerMigration(migration1);
    
    const status = await migrationManager.applyMigrations();
    
    expect(status.ok).toBe(true);
    expect(status.currentVersion).toBe(2);
    
    // Verify migrations were applied in correct order
    const migrationsResult = await db.query<{version: number}>("SELECT * FROM migrations ORDER BY version");
    expect(migrationsResult.rows.length).toBe(2);
    expect(migrationsResult.rows[0].version).toBe(1);
    expect(migrationsResult.rows[1].version).toBe(2);
  });
});