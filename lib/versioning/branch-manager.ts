/**
 * Branch Manager - File Versioning System
 * 
 * Creates safe branches of project files when users make edits.
 * Original files remain untouched; changes go to branches/{branch_id}_{username}/
 */

import { promises as fs } from 'fs';
import path from 'path';

interface BranchMetadata {
  id: string;
  username: string;
  createdAt: string;
  basePath: string;
  branchPath: string;
  files: string[];
  description?: string;
}

interface BranchConfig {
  projectRoot: string;
  branchesDir?: string; // defaults to 'branches'
}

export class BranchManager {
  private projectRoot: string;
  private branchesDir: string;
  private metadataFile: string;

  constructor(config: BranchConfig) {
    this.projectRoot = config.projectRoot;
    this.branchesDir = path.join(this.projectRoot, config.branchesDir || 'branches');
    this.metadataFile = path.join(this.branchesDir, 'branches.json');
  }

  /**
   * Create a new branch from the current project state
   */
  async createBranch(username: string, filesToBranch: string[], description?: string): Promise<BranchMetadata> {
    // Ensure branches directory exists
    await fs.mkdir(this.branchesDir, { recursive: true });

    // Get existing branches to determine next ID
    const existingBranches = await this.listBranches();
    const branchNumber = existingBranches.length + 1;
    
    // Sanitize username for filesystem
    const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const branchId = `branch_${branchNumber}_${safeUsername}`;
    const branchPath = path.join(this.branchesDir, branchId);

    // Create branch directory
    await fs.mkdir(branchPath, { recursive: true });

    // Copy files to branch
    const copiedFiles: string[] = [];
    for (const file of filesToBranch) {
      const sourcePath = path.join(this.projectRoot, file);
      const destPath = path.join(branchPath, file);
      
      try {
        // Ensure destination directory exists
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        
        // Copy the file
        await fs.copyFile(sourcePath, destPath);
        copiedFiles.push(file);
      } catch (error) {
        console.error(`Failed to copy ${file}:`, error);
      }
    }

    // Create branch metadata
    const metadata: BranchMetadata = {
      id: branchId,
      username: username,
      createdAt: new Date().toISOString(),
      basePath: this.projectRoot,
      branchPath: branchPath,
      files: copiedFiles,
      description: description,
    };

    // Save metadata
    await this.saveBranchMetadata(metadata);

    return metadata;
  }

  /**
   * Create a branch for a single file edit
   */
  async branchFile(username: string, filePath: string, description?: string): Promise<BranchMetadata> {
    return this.createBranch(username, [filePath], description);
  }

  /**
   * List all branches
   */
  async listBranches(): Promise<BranchMetadata[]> {
    try {
      const data = await fs.readFile(this.metadataFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Get a specific branch by ID
   */
  async getBranch(branchId: string): Promise<BranchMetadata | null> {
    const branches = await this.listBranches();
    return branches.find(b => b.id === branchId) || null;
  }

  /**
   * Get branches for a specific user
   */
  async getUserBranches(username: string): Promise<BranchMetadata[]> {
    const branches = await this.listBranches();
    return branches.filter(b => b.username === username);
  }

  /**
   * Read a file from a branch
   */
  async readBranchFile(branchId: string, filePath: string): Promise<string> {
    const branch = await this.getBranch(branchId);
    if (!branch) throw new Error(`Branch ${branchId} not found`);
    
    const fullPath = path.join(branch.branchPath, filePath);
    return fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Write to a file in a branch (creates branch if editing original)
   */
  async writeToFile(
    username: string, 
    filePath: string, 
    content: string, 
    branchId?: string
  ): Promise<{ branchId: string; filePath: string }> {
    let targetBranch: BranchMetadata;

    if (branchId) {
      // Writing to existing branch
      const branch = await this.getBranch(branchId);
      if (!branch) throw new Error(`Branch ${branchId} not found`);
      targetBranch = branch;
    } else {
      // Create new branch for this edit
      targetBranch = await this.branchFile(
        username, 
        filePath, 
        `Edit to ${filePath}`
      );
    }

    const fullPath = path.join(targetBranch.branchPath, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');

    return { branchId: targetBranch.id, filePath };
  }

  /**
   * Merge a branch back to main (optional - for approved changes)
   */
  async mergeBranch(branchId: string): Promise<void> {
    const branch = await this.getBranch(branchId);
    if (!branch) throw new Error(`Branch ${branchId} not found`);

    for (const file of branch.files) {
      const branchFile = path.join(branch.branchPath, file);
      const mainFile = path.join(this.projectRoot, file);
      
      try {
        const content = await fs.readFile(branchFile, 'utf-8');
        await fs.writeFile(mainFile, content, 'utf-8');
      } catch (error) {
        console.error(`Failed to merge ${file}:`, error);
      }
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(branchId: string): Promise<void> {
    const branch = await this.getBranch(branchId);
    if (!branch) return;

    // Remove branch directory
    await fs.rm(branch.branchPath, { recursive: true, force: true });

    // Update metadata
    const branches = await this.listBranches();
    const updated = branches.filter(b => b.id !== branchId);
    await fs.writeFile(this.metadataFile, JSON.stringify(updated, null, 2));
  }

  private async saveBranchMetadata(metadata: BranchMetadata): Promise<void> {
    const branches = await this.listBranches();
    branches.push(metadata);
    await fs.writeFile(this.metadataFile, JSON.stringify(branches, null, 2));
  }
}

// Singleton instances for projects
let soulprintBranchManager: BranchManager | null = null;

export function getSoulprintBranchManager(): BranchManager {
  if (!soulprintBranchManager) {
    soulprintBranchManager = new BranchManager({
      projectRoot: process.cwd(),
      branchesDir: 'branches',
    });
  }
  return soulprintBranchManager;
}

// Export default for easy import
export default BranchManager;
