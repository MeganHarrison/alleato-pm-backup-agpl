import net from 'net';
import http from 'http';

/**
 * Check if a port is in use
 */
export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(true); // Port is in use
    });

    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free
    });

    server.listen(port);
  });
}

/**
 * Check if server is responding on a port
 */
export async function isServerResponding(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode !== undefined);
    }).on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Find which port the dev server is running on
 */
export async function findDevServerPort(): Promise<number | null> {
  const commonPorts = [3000, 3001, 3002, 3003, 8080, 8000];

  for (const port of commonPorts) {
    if (await isServerResponding(`http://localhost:${port}`)) {
      console.log(`✅ Found dev server on port ${port}`);
      return port;
    }
  }

  console.log('❌ No dev server found on common ports');
  return null;
}

/**
 * Get the base URL for tests
 */
export async function getTestBaseURL(): Promise<string> {
  // Priority order:
  // 1. Environment variable
  if (process.env.PLAYWRIGHT_BASE_URL) {
    return process.env.PLAYWRIGHT_BASE_URL;
  }

  // 2. Auto-detect running server
  const port = await findDevServerPort();
  if (port) {
    return `http://localhost:${port}`;
  }

  // 3. Default fallback
  return 'http://localhost:3000';
}