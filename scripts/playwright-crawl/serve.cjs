#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown',
};

// Track connected SSE clients
const clients = new Set();

// Project configurations
const projects = {
  'budget': {
    name: 'Budget',
    folder: 'procore-budget-crawl'
  },
  'prime-contracts': {
    name: 'Prime Contracts',
    folder: 'procore-prime-contracts-crawl'
  },
  'support': {
    name: 'Support',
    folder: 'procore-support-crawl'
  },
  'docs': {
    name: 'Documentation',
    folder: 'docs'
  }
};

// Watch for file changes in all project directories
Object.entries(projects).forEach(([key, project]) => {
  const projectDir = path.join(BASE_DIR, project.folder);
  const watchedDirs = [
    path.join(projectDir, 'reports'),
    projectDir
  ];

  watchedDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.watch(dir, { recursive: false }, (_eventType, filename) => {
        if (filename?.endsWith('.md')) {
          console.log(`📝 [${project.name}] File changed: ${filename}`);
          // Notify all connected clients
          clients.forEach(client => {
            client.write(`data: ${JSON.stringify({ type: 'reload', file: filename, project: key })}\n\n`);
          });
        }
      });
    }
  });
});

// Function to scan for markdown files in a project directory
function getMarkdownFiles(projectKey) {
  const project = projects[projectKey];
  if (!project) return [];

  const files = [];
  const projectDir = path.join(BASE_DIR, project.folder);

  if (!fs.existsSync(projectDir)) {
    console.warn(`⚠️  Project directory not found: ${projectDir}`);
    return [];
  }

  // Scan base directory
  try {
    const baseFiles = fs.readdirSync(projectDir);
    baseFiles.forEach(file => {
      if (file.endsWith('.md')) {
        const stats = fs.statSync(path.join(projectDir, file));
        files.push({
          name: file.replace('.md', '').replace(/-/g, ' ').replace(/_/g, ' '),
          path: file,
          category: 'Main',
          mtime: stats.mtime
        });
      }
    });
  } catch (error) {
    console.error(`Error reading ${projectDir}:`, error);
  }

  // Scan reports directory
  const reportsDir = path.join(projectDir, 'reports');
  if (fs.existsSync(reportsDir)) {
    try {
      const reportFiles = fs.readdirSync(reportsDir);
      reportFiles.forEach(file => {
        if (file.endsWith('.md')) {
          const stats = fs.statSync(path.join(reportsDir, file));
          files.push({
            name: file.replace('.md', '').replace(/-/g, ' ').replace(/_/g, ' '),
            path: `reports/${file}`,
            category: 'Reports',
            mtime: stats.mtime
          });
        }
      });
    } catch (error) {
      console.error(`Error reading ${reportsDir}:`, error);
    }
  }

  // Sort by modification time (newest first)
  return files.sort((a, b) => b.mtime - a.mtime);
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // API endpoint to list markdown files
  if (req.url.startsWith('/api/files')) {
    const urlParams = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const projectKey = urlParams.get('project') || 'budget';

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getMarkdownFiles(projectKey)));
    return;
  }

  // SSE endpoint for live reload
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Add client to set
    clients.add(res);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Remove client when connection closes
    req.on('close', () => {
      clients.delete(res);
    });

    return;
  }

  // Default to viewer.html for root
  let filePath = req.url === '/' ? '/viewer.html' : req.url;
  filePath = path.join(BASE_DIR, filePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
      return;
    }

    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ Alleato Procore Crawl Viewer running at:\n`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log(`📡 Live reload enabled for all projects\n`);
  console.log(`📂 Projects:`);
  Object.entries(projects).forEach(([key, project]) => {
    const projectDir = path.join(BASE_DIR, project.folder);
    const exists = fs.existsSync(projectDir) ? '✓' : '✗';
    console.log(`   ${exists} ${project.name} (${project.folder})`);
  });
  console.log(`\nPress Ctrl+C to stop the server\n`);
});
