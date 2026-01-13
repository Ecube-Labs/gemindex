import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.gemindex');
const COOKIES_FILE = path.join(CONFIG_DIR, 'cookies.json');
const COOKIE_NAME = '_oauth2_proxy';

interface StoredCookie {
  host: string;
  value: string;
  expires: number;
}

function loadCookie(host: string): string | null {
  if (!fs.existsSync(COOKIES_FILE)) return null;

  try {
    const cookies: StoredCookie[] = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
    const cookie = cookies.find((c) => c.host === host);

    if (!cookie || Date.now() > cookie.expires) return null;
    return cookie.value;
  } catch {
    return null;
  }
}

function saveCookie(host: string, value: string, expires: number): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  let cookies: StoredCookie[] = [];
  if (fs.existsSync(COOKIES_FILE)) {
    try {
      cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
    } catch {
      cookies = [];
    }
  }

  cookies = cookies.filter((c) => c.host !== host);
  cookies.push({ host, value, expires });
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
}

async function captureOAuthCookie(host: string, browserPath?: string): Promise<string> {
  console.error('Opening browser for OAuth login...');
  console.error(`Target: ${host}`);
  if (browserPath) {
    console.error(`Using browser: ${browserPath}`);
  }

  const browser = await chromium.launch({
    headless: false,
    executablePath: browserPath,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(host);

  console.error('Please complete the login in the browser...');

  // Wait for cookie with timeout
  let cookie = null;
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();

  while (!cookie) {
    if (Date.now() - startTime > maxWaitTime) {
      await browser.close();
      throw new Error('Login timeout - please try again');
    }

    const cookies = await context.cookies();
    cookie = cookies.find((c) => c.name === COOKIE_NAME);
    if (!cookie) {
      await page.waitForTimeout(1000);
    }
  }

  console.error('OAuth cookie captured!');
  await browser.close();

  // Save cookie (use cookie expiry or default 24h)
  const expires = cookie.expires ? cookie.expires * 1000 : Date.now() + 24 * 60 * 60 * 1000;
  saveCookie(host, cookie.value, expires);

  return cookie.value;
}

export async function ensureAuthenticated(host: string, browserPath?: string): Promise<string> {
  const cached = loadCookie(host);
  if (cached) {
    console.error('Using cached OAuth cookie');
    return cached;
  }
  return captureOAuthCookie(host, browserPath);
}

export function clearCookie(host?: string): void {
  if (!fs.existsSync(COOKIES_FILE)) return;

  if (host) {
    let cookies: StoredCookie[] = [];
    try {
      cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
    } catch {
      return;
    }
    cookies = cookies.filter((c) => c.host !== host);
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.error(`Cleared cookie for ${host}`);
  } else {
    fs.unlinkSync(COOKIES_FILE);
    console.error('Cleared all cookies');
  }
}
