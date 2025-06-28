import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { access, constants } from 'fs';

const execAsync = promisify(exec);
const accessAsync = promisify(access);

describe('NPM Installation Test', () => {
  const projectRoot = process.cwd();
  const distBinPath = join(projectRoot, 'dist', 'bin', 'cli.js');

  beforeAll(async () => {
    // Ensure the project is built
    try {
      await execAsync('npm run build', { cwd: projectRoot });
    } catch (error) {
      console.warn('Build failed, but continuing with tests...');
    }
  });

  test('should have compiled binary available', async () => {
    try {
      await accessAsync(distBinPath, constants.F_OK);
    } catch (error) {
      throw new Error(`Binary not found at ${distBinPath}`);
    }
  });

  test('should show version when executed with --version', async () => {
    const { stdout } = await execAsync(`node "${distBinPath}" --version`);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('should show help when executed with --help', async () => {
    const { stdout } = await execAsync(`node "${distBinPath}" --help`);
    
    // Check for key help sections
    expect(stdout).toContain('Available Commands:');
    expect(stdout).toContain('fake-it-til-you-git (full name)');
    expect(stdout).toContain('fityg (shortcut)');
    expect(stdout).toContain('Examples:');
    expect(stdout).toContain('Configuration:');
    expect(stdout).toContain('Distribution Types:');
    expect(stdout).toContain('Message Styles:');
  });

  test('should have all required npm binary configurations', () => {
    const packageJson = require('../../package.json');
    
    // Check bin configurations
    expect(packageJson.bin).toBeDefined();
    expect(packageJson.bin['fake-it-til-you-git']).toBe('dist/bin/cli.js');
    expect(packageJson.bin['fityg']).toBe('dist/bin/cli.js');
    
    // Check other important package.json fields
    expect(packageJson.main).toBe('dist/main.js');
    expect(packageJson.type).toBe('module');
    expect(packageJson.engines.node).toBeDefined();
    
    // Check files field includes required directories
    expect(packageJson.files).toContain('dist/src/');
    expect(packageJson.files).toContain('dist/bin/');
    expect(packageJson.files).toContain('templates/');
    expect(packageJson.files).toContain('test-configs/');
  });

  test('should have proper publishing scripts', () => {
    const packageJson = require('../../package.json');
    
    expect(packageJson.scripts.prepublishOnly).toBeDefined();
    expect(packageJson.scripts.postversion).toBeDefined();
    expect(packageJson.scripts['version:patch']).toBeDefined();
    expect(packageJson.scripts['version:minor']).toBeDefined();
    expect(packageJson.scripts['version:major']).toBeDefined();
    expect(packageJson.scripts['publish:patch']).toBeDefined();
    expect(packageJson.scripts['publish:minor']).toBeDefined();
    expect(packageJson.scripts['publish:major']).toBeDefined();
  });

  test('should validate CLI argument parsing', async () => {
    // Test with invalid argument - should show error
    try {
      await execAsync(`node "${distBinPath}" --invalid-option`);
      fail('Should have thrown an error for invalid option');
    } catch (error: any) {
      // Should contain help usage information
      expect(error.stdout || error.stderr).toContain('Use --help for usage information');
    }
  });

  test('should accept valid arguments without errors', async () => {
    // Test with preview mode (safe)
    const { stdout, stderr } = await execAsync(`node "${distBinPath}" --preview --dev --days 1`);
    
    // Should not contain error messages
    expect(stderr).not.toContain('Error:');
    expect(stderr).not.toContain('❌');
    
    // Should contain preview content
    expect(stdout).toContain('HISTORY PREVIEW');
  });

  test('should show reproducible results with seed', async () => {
    const seed = 'test-seed-123';
    
    // Run twice with the same seed
    const { stdout: output1 } = await execAsync(`node "${distBinPath}" --preview --dev --days 3 --seed "${seed}"`);
    const { stdout: output2 } = await execAsync(`node "${distBinPath}" --preview --dev --days 3 --seed "${seed}"`);
    
    // Both outputs should be identical when using the same seed
    expect(output1).toBe(output2);
  });

  test('should handle config file loading', async () => {
    const configPath = join(projectRoot, 'test-configs', 'fake-git.config.json');
    
    // Verify config file exists
    try {
      await accessAsync(configPath, constants.F_OK);
    } catch (error) {
      throw new Error(`Config file not found at ${configPath}`);
    }
    
    // Test with custom config
    const { stdout } = await execAsync(`node "${distBinPath}" --preview --dev --config "${configPath}"`);
    expect(stdout).toContain('HISTORY PREVIEW');
  });
}); 