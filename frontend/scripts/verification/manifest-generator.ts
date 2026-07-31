#!/usr/bin/env node
/**
 * Task Manifest Generator
 * Generates verification manifest based on git changes and task context
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TaskManifest {
  task_id: string;
  task_type: 'feature' | 'bug-fix' | 'refactor' | 'ui-change' | 'api' | 'database' | 'config';
  description: string;
  files_modified: string[];
  changes: {
    added: string[];
    modified: string[];
    removed: string[];
  };
  verification_needed: {
    code_quality: boolean;
    visual: boolean;
    functional: boolean;
    integration: boolean;
    performance: boolean;
    security: boolean;
  };
  success_criteria: string[];
  test_scenarios: Array<{
    type: string;
    targets: string[];
    checks: string[];
  }>;
}

export class ManifestGenerator {
  async generateFromGitChanges(taskDescription: string): Promise<TaskManifest> {
    const taskId = `task-${Date.now()}`;
    const files = this.getModifiedFiles();
    const taskType = this.detectTaskType(files, taskDescription);
    const changes = this.analyzeChanges(files);
    
    const manifest: TaskManifest = {
      task_id: taskId,
      task_type: taskType,
      description: taskDescription,
      files_modified: files,
      changes,
      verification_needed: this.determineVerificationNeeds(files, taskType),
      success_criteria: this.generateSuccessCriteria(taskType, files, taskDescription),
      test_scenarios: this.generateTestScenarios(taskType, files)
    };
    
    return manifest;
  }

  private getModifiedFiles(): string[] {
    try {
      const output = execSync('git diff --name-only HEAD~1..HEAD', { encoding: 'utf8' });
      return output.trim().split('\n').filter(f => f.length > 0);
    } catch {
      // Fallback to staged files
      const output = execSync('git diff --name-only --cached', { encoding: 'utf8' });
      return output.trim().split('\n').filter(f => f.length > 0);
    }
  }

  private detectTaskType(files: string[], description: string): TaskManifest['task_type'] {
    const desc = description.toLowerCase();
    
    // Description-based detection
    if (desc.includes('layout') || desc.includes('spacing') || desc.includes('style')) {
      return 'ui-change';
    }
    if (desc.includes('api') || desc.includes('endpoint')) {
      return 'api';
    }
    if (desc.includes('database') || desc.includes('migration') || desc.includes('schema')) {
      return 'database';
    }
    if (desc.includes('fix') || desc.includes('bug')) {
      return 'bug-fix';
    }
    if (desc.includes('refactor')) {
      return 'refactor';
    }
    
    // File-based detection
    const hasUI = files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx') || f.includes('/components/'));
    const hasAPI = files.some(f => f.includes('/api/') || f.includes('route.ts'));
    const hasDB = files.some(f => f.includes('migration') || f.includes('schema'));
    
    if (hasUI && !hasAPI) return 'ui-change';
    if (hasAPI) return 'api';
    if (hasDB) return 'database';
    
    return 'feature';
  }

  private analyzeChanges(files: string[]): TaskManifest['changes'] {
    const changes = {
      added: [] as string[],
      modified: [] as string[],
      removed: [] as string[]
    };
    
    for (const file of files) {
      try {
        const diffStat = execSync(`git diff HEAD~1..HEAD --stat -- "${file}"`, { encoding: 'utf8' });
        
        if (diffStat.includes('new file')) {
          changes.added.push(file);
        } else if (diffStat.includes('delete')) {
          changes.removed.push(file);
        } else {
          changes.modified.push(file);
        }
      } catch {
        changes.modified.push(file);
      }
    }
    
    return changes;
  }

  private determineVerificationNeeds(
    files: string[], 
    taskType: TaskManifest['task_type']
  ): TaskManifest['verification_needed'] {
    const needs = {
      code_quality: true, // Always check code quality
      visual: false,
      functional: false,
      integration: false,
      performance: false,
      security: false
    };
    
    // Task type specific needs
    switch (taskType) {
      case 'ui-change':
        needs.visual = true;
        needs.functional = true;
        break;
      case 'api':
        needs.functional = true;
        needs.integration = true;
        needs.security = true;
        break;
      case 'database':
        needs.integration = true;
        needs.performance = true;
        break;
      case 'feature':
        needs.functional = true;
        needs.integration = true;
        needs.visual = files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'));
        break;
    }
    
    // File-specific overrides
    if (files.some(f => f.includes('auth') || f.includes('permission'))) {
      needs.security = true;
    }
    
    if (files.some(f => f.includes('query') || f.includes('infinite'))) {
      needs.performance = true;
    }
    
    return needs;
  }

  private generateSuccessCriteria(
    taskType: TaskManifest['task_type'],
    files: string[],
    description: string
  ): string[] {
    const criteria: string[] = [
      'No TypeScript errors',
      'No ESLint errors',
      'All tests pass'
    ];
    
    switch (taskType) {
      case 'ui-change':
        criteria.push('Visual appearance matches design requirements');
        criteria.push('Responsive behavior works on all viewports');
        criteria.push('No layout regressions');
        
        // Specific layout criteria
        if (description.includes('dashboard') || description.includes('executive')) {
          criteria.push('Dashboard uses >95% of viewport width');
          criteria.push('Edge padding between 8-24px');
        }
        break;
        
      case 'api':
        criteria.push('API returns correct response format');
        criteria.push('Error handling returns appropriate status codes');
        criteria.push('Authentication/authorization works correctly');
        break;
        
      case 'database':
        criteria.push('Migration runs successfully');
        criteria.push('Rollback works without data loss');
        criteria.push('Query performance acceptable');
        break;
    }
    
    return criteria;
  }

  private generateTestScenarios(
    taskType: TaskManifest['task_type'],
    files: string[]
  ): TaskManifest['test_scenarios'] {
    const scenarios: TaskManifest['test_scenarios'] = [];
    
    if (taskType === 'ui-change' || files.some(f => f.endsWith('.tsx'))) {
      // Find pages that might be affected
      const pages = this.findAffectedPages(files);
      
      scenarios.push({
        type: 'visual',
        targets: pages,
        checks: ['layout-metrics', 'responsive-behavior', 'visual-regression']
      });
    }
    
    if (taskType === 'api' || files.some(f => f.includes('/api/'))) {
      const endpoints = this.findAffectedEndpoints(files);
      
      scenarios.push({
        type: 'api',
        targets: endpoints,
        checks: ['response-format', 'error-handling', 'performance']
      });
    }
    
    if (taskType === 'feature') {
      scenarios.push({
        type: 'e2e',
        targets: ['user-flow'],
        checks: ['happy-path', 'edge-cases', 'error-states']
      });
    }
    
    return scenarios;
  }

  private findAffectedPages(files: string[]): string[] {
    const pages: string[] = [];
    
    for (const file of files) {
      // Direct page files
      if (file.includes('/app/') && file.endsWith('page.tsx')) {
        const pagePath = file
          .replace(/.*\/app/, '')
          .replace('/page.tsx', '')
          .replace(/\[([^\]]+)\]/g, ':$1') || '/';
        pages.push(pagePath);
      }
      
      // Component files - try to find which pages use them
      if (file.includes('/components/')) {
        const componentName = path.basename(file, path.extname(file));
        // This is simplified - in reality would search for imports
        if (componentName.includes('dashboard')) pages.push('/dashboard');
        if (componentName.includes('executive')) pages.push('/executive');
      }
    }
    
    return [...new Set(pages)];
  }

  private findAffectedEndpoints(files: string[]): string[] {
    const endpoints: string[] = [];
    
    for (const file of files) {
      if (file.includes('/api/') && file.endsWith('route.ts')) {
        const endpoint = file
          .replace(/.*\/api/, '/api')
          .replace('/route.ts', '')
          .replace(/\[([^\]]+)\]/g, ':$1');
        endpoints.push(endpoint);
      }
    }
    
    return endpoints;
  }

  async saveManifest(manifest: TaskManifest, outputPath?: string): Promise<string> {
    const manifestPath = outputPath || `.claude/verification/manifests/${manifest.task_id}.json`;
    const dir = path.dirname(manifestPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return manifestPath;
  }
}

// CLI usage
if (require.main === module) {
  const generator = new ManifestGenerator();
  const taskDescription = process.argv.slice(2).join(' ') || 'Task completed';
  
  generator.generateFromGitChanges(taskDescription)
    .then(manifest => {
      console.log('Generated manifest:', JSON.stringify(manifest, null, 2));
      return generator.saveManifest(manifest);
    })
    .then(path => {
      console.log(`Manifest saved to: ${path}`);
    })
    .catch(console.error);
}