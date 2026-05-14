import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';

export class GitService {
  private git: SimpleGit;
  private repoPath: string;
  private repoPrefix: string;
  private repoUrl: string;
  private pat: string;
  private githubUsername: string;

  constructor(baseDir: string, repoPrefix: string, repoUrl: string, pat: string, githubUsername = 'kiro-agent') {
    this.repoPrefix = repoPrefix;
    this.repoUrl = repoUrl;
    this.pat = pat;
    this.githubUsername = githubUsername;
    this.repoPath = path.join(baseDir, repoPrefix);
    
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    this.git = simpleGit();
  }

  getRepoPath(): string {
    return this.repoPath;
  }

  private getAuthUrl(): string {
    if (!this.pat) return this.repoUrl;

    try {
      // Injects the PAT into the URL (e.g., https://<PAT>@github.com/org/repo.git)
      const urlObj = new URL(this.repoUrl);
      urlObj.username = this.pat;
      return urlObj.toString();
    } catch (e) {
      console.warn(`[GitService] Invalid repoUrl format: ${this.repoUrl}`);
      return this.repoUrl;
    }
  }

  async cloneOnly(): Promise<void> {
    const remoteUrl = this.getAuthUrl();
    if (!fs.existsSync(this.repoPath)) {
      console.log(`[GitService] Cloning repository ${this.repoPrefix}...`);
      await this.git.clone(remoteUrl, this.repoPath);
    }
  }

  /** Pulls latest changes only if the repo is currently on the main branch. Returns true if pull was performed. */
  async pullIfOnMain(): Promise<boolean> {
    if (!fs.existsSync(path.join(this.repoPath, '.git'))) return false;

    this.git = simpleGit(this.repoPath);
    await this.git.addConfig('safe.directory', this.repoPath, false, 'global');

    const remoteUrl = this.getAuthUrl();
    await this.git.remote(['set-url', 'origin', remoteUrl]);

    const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
    const currentBranch = branch.trim();

    if (currentBranch === 'main' || currentBranch === 'master') {
      console.log(`[GitService] ${this.repoPrefix} is on ${currentBranch} — pulling latest changes...`);
      await this.git.fetch();
      await this.git.pull('origin', currentBranch);
      return true;
    }

    return false;
  }

  async syncAndBranch(branchName: string): Promise<void> {
    await this.cloneOnly();
    const remoteUrl = this.getAuthUrl();

    this.git = simpleGit(this.repoPath);

    // Allow git to run in folders with different owner (Host vs Docker root)
    await this.git.addConfig('safe.directory', this.repoPath, false, 'global');

    // Configure commit author identity for this repo
    await this.git.addConfig('user.name', this.githubUsername);
    await this.git.addConfig('user.email', `${this.githubUsername}@users.noreply.github.com`);

    // Update origin URL to inject PAT authentication
    await this.git.remote(['set-url', 'origin', remoteUrl]);

    console.log(`[GitService] Fetching and syncing main branch...`);
    await this.git.fetch();
    await this.git.checkout('main');
    await this.git.pull('origin', 'main');

    console.log(`[GitService] Checking out branch ${branchName}...`);
    // Create branch if it doesn't exist
    const branchSummary = await this.git.branch();
    if (!branchSummary.all.includes(branchName)) {
      await this.git.checkoutLocalBranch(branchName);
    } else {
      await this.git.checkout(branchName);
    }
  }

  async commit(taskId: string, description: string): Promise<void> {
    console.log(`[GitService] Committing changes...`);
    await this.git.add('./*');
    const commitMessage = `feat: ${taskId} - ${description}`;
    await this.git.commit(commitMessage);
  }

  async push(branchName: string): Promise<void> {
    const remoteUrl = this.getAuthUrl();
    await this.git.remote(['set-url', 'origin', remoteUrl]);
    console.log(`[GitService] Pushing branch ${branchName} to origin...`);
    await this.git.push('origin', branchName, ['--set-upstream']);
    console.log(`[GitService] Push complete.`);
  }
}
