import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';
import { join } from 'path';

const url = process.argv[2] || 'https://dorahacks.io/hackathon/buidlbattle2/buidl';
const label = process.argv[3] || 'page';
const outDir = join(import.meta.dirname, 'screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
// Wait for dynamic content to render
await new Promise(r => setTimeout(r, 5000));
// Scroll down to load lazy content
await page.evaluate(() => window.scrollTo(0, 500));
await new Promise(r => setTimeout(r, 2000));

const path = join(outDir, `screenshot-${label}.png`);
await page.screenshot({ path, fullPage: true });
console.log(`Screenshot saved to: ${path}`);
await browser.close();
