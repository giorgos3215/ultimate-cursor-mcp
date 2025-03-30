import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';

interface ScreenshotInput {
  url: string;
  output?: string;
  width?: number;
  height?: number;
}

interface ScreenshotResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

/**
 * Create a function to handle the screenshot tool
 */
export function createScreenshotTool() {
  return async (input: ScreenshotInput): Promise<ScreenshotResponse> => {
    const { url, output = 'screenshot.png', width = 1280, height = 800 } = input;
    
    try {
      // For demo purposes, we'll use the Python tool with child_process first
      // While also implementing a native version as a fallback
      try {
        const { spawn } = childProcess;
        
        const args = [
          './tools/screenshot_utils.py',
          url,
          '--output', output,
          '--width', width.toString(),
          '--height', height.toString()
        ];
        
        return await new Promise((resolve, reject) => {
          const pythonProcess = spawn('venv/bin/python3', args);
          let outputText = '';
          let errorOutput = '';
          
          pythonProcess.stdout.on('data', (data: Buffer) => {
            outputText += data.toString();
          });
          
          pythonProcess.stderr.on('data', (data: Buffer) => {
            errorOutput += data.toString();
          });
          
          pythonProcess.on('close', (code: number) => {
            if (code !== 0) {
              console.error(`Screenshot utility error: ${errorOutput}`);
              console.warn('Falling back to native implementation...');
              // Don't reject, we'll try the native implementation
              throw new Error(`Screenshot process exited with code ${code}`);
            }
            
            resolve({
              content: [
                {
                  type: 'text',
                  text: `Screenshot saved to ${output}. ${outputText.trim()}`,
                },
              ],
            });
          });
        });
      } catch (error) {
        // Fallback to native implementation if Python tool fails
        console.info('Using native screenshot implementation');
        const screenshotPath = await takeScreenshot(url, output, width, height);
        
        return {
          content: [
            {
              type: 'text',
              text: `Screenshot saved to ${screenshotPath}.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error('Error in screenshot tool:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error taking screenshot: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  };
}

/**
 * Native implementation of taking a screenshot using Puppeteer
 */
async function takeScreenshot(url: string, outputPath: string, width: number = 1280, height: number = 800): Promise<string> {
  let browser;
  try {
    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Launch a headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    // Open a new page
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({
      width,
      height,
      deviceScaleFactor: 1,
    });
    
    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Navigate to the URL
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    // Take a screenshot
    await page.screenshot({
      path: outputPath,
      fullPage: false,
    });
    
    return outputPath;
  } catch (error) {
    console.error('Error taking screenshot with Puppeteer:', error);
    throw error;
  } finally {
    // Close the browser
    if (browser) {
      await browser.close();
    }
  }
} 