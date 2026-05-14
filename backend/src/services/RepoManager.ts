import fs from 'fs';
import path from 'path';
import { GitService } from './GitService';
import { runQuery } from '../config/db';

export type RepoStatus = 'missing' | 'cloning' | 'ready' | 'error';

class RepoManager {
  private statusMap: Map<string, RepoStatus> = new Map();
  private baseDir = '/app/repos';

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public getStatusMap(): Record<string, RepoStatus> {
    const obj: Record<string, RepoStatus> = {};
    for (const [key, value] of this.statusMap.entries()) {
      obj[key] = value;
    }
    return obj;
  }

  public async syncRepositories(mappings: Record<string, string>, gitPat: string, githubUsername = 'kiro-agent'): Promise<void> {
    for (const [prefix, url] of Object.entries(mappings)) {
      if (!prefix || !url) continue;

      // Skip if already being cloned
      if (this.statusMap.get(prefix) === 'cloning') continue;

      const repoPath = path.join(this.baseDir, prefix);

      if (fs.existsSync(path.join(repoPath, '.git'))) {
        // Repo already cloned — pull if on main
        this.statusMap.set(prefix, 'ready');
        this.pullIfOnMain(prefix, url, gitPat, githubUsername).catch(e =>
          console.error(`[RepoManager] Pull failed for ${prefix}:`, e)
        );
      } else {
        this.statusMap.set(prefix, 'missing');
        this.cloneRepository(prefix, url, gitPat, githubUsername).catch(e => console.error(e));
      }
    }
  }

  /** Called on server startup — loads mappings from DB and syncs all repos */
  public async bootstrapFromDb(): Promise<void> {
    try {
      const rows = await runQuery("SELECT value FROM settings WHERE key = 'repo_mappings'");
      const patRow = await runQuery("SELECT value FROM settings WHERE key = 'git_pat'");
      const usernameRow = await runQuery("SELECT value FROM settings WHERE key = 'github_username'");

      if (!rows || rows.length === 0) {
        console.log('[RepoManager] No repo_mappings found in settings — skipping bootstrap sync.');
        return;
      }

      const mappings: Record<string, string> = JSON.parse((rows[0] as any).value || '{}');
      const gitPat: string = patRow?.[0] ? (patRow[0] as any).value : '';
      const githubUsername: string = usernameRow?.[0] ? (usernameRow[0] as any).value : 'kiro-agent';

      console.log(`[RepoManager] Bootstrap: syncing ${Object.keys(mappings).length} repository mapping(s)...`);
      await this.syncRepositories(mappings, gitPat, githubUsername);
    } catch (e) {
      console.error('[RepoManager] Bootstrap sync failed:', e);
    }
  }

  private async cloneRepository(prefix: string, url: string, pat: string, githubUsername: string) {
    this.statusMap.set(prefix, 'cloning');
    console.log(`[RepoManager] Starting background clone for ${prefix}...`);
    try {
      const gitService = new GitService(this.baseDir, prefix, url, pat, githubUsername);
      await gitService.cloneOnly();
      this.statusMap.set(prefix, 'ready');
      console.log(`[RepoManager] Successfully cloned ${prefix}.`);
    } catch (error) {
      console.error(`[RepoManager] Error cloning ${prefix}:`, error);
      this.statusMap.set(prefix, 'error');
    }
  }

  private async pullIfOnMain(prefix: string, url: string, pat: string, githubUsername: string) {
    try {
      const gitService = new GitService(this.baseDir, prefix, url, pat, githubUsername);
      const pulled = await gitService.pullIfOnMain();
      if (pulled) {
        console.log(`[RepoManager] Pulled latest changes for ${prefix} (main).`);
      } else {
        console.log(`[RepoManager] ${prefix} is not on main branch — skipping pull.`);
      }
    } catch (e) {
      console.warn(`[RepoManager] Could not pull ${prefix}:`, e);
    }
  }
}

export const repoManager = new RepoManager();
