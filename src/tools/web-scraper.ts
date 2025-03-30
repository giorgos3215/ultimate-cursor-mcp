import * as childProcess from 'child_process';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface WebScraperInput {
  url: string;
  selector?: string;
  max_content_length?: number;
}

interface WebScraperResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

/**
 * Create a function to handle the web scraper tool
 */
export function createWebScraperTool() {
  return async (input: WebScraperInput): Promise<WebScraperResponse> => {
    const { url, selector, max_content_length = 10000 } = input;
    
    try {
      // For demo purposes, we'll use the Python tool with child_process first
      // While also implementing a native version as a fallback
      try {
        const { spawn } = childProcess;
        
        const args = [
          './tools/web_scraper.py',
          url
        ];
        
        if (selector) {
          args.push('--selector', selector);
        }
        
        args.push('--max-length', max_content_length.toString());
        
        return await new Promise((resolve, reject) => {
          const pythonProcess = spawn('venv/bin/python3', args);
          let output = '';
          let errorOutput = '';
          
          pythonProcess.stdout.on('data', (data: Buffer) => {
            output += data.toString();
          });
          
          pythonProcess.stderr.on('data', (data: Buffer) => {
            errorOutput += data.toString();
          });
          
          pythonProcess.on('close', (code: number) => {
            if (code !== 0) {
              console.error(`Web scraper error: ${errorOutput}`);
              console.warn('Falling back to native implementation...');
              // Don't reject, we'll try the native implementation
              throw new Error(`Web scraper process exited with code ${code}`);
            }
            
            resolve({
              content: [
                {
                  type: 'text',
                  text: output.trim(),
                },
              ],
            });
          });
        });
      } catch (error) {
        // Fallback to native implementation if Python tool fails
        console.info('Using native web scraper implementation');
        const content = await scrapeWebPage(url, selector, max_content_length);
        
        return {
          content: [
            {
              type: 'text',
              text: content,
            },
          ],
        };
      }
    } catch (error) {
      console.error('Error in web scraper tool:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error scraping web page: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  };
}

/**
 * Native implementation of web scraping using axios and cheerio
 */
async function scrapeWebPage(url: string, selector?: string, maxLength: number = 10000): Promise<string> {
  try {
    // Fetch the page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    // Load the HTML into cheerio
    const $ = cheerio.load(response.data);
    
    // Remove script and style elements
    $('script, style, iframe, noscript').remove();
    
    // Extract content
    let content: string;
    if (selector) {
      content = $(selector).text();
    } else {
      content = $('body').text();
    }
    
    // Clean the content
    content = content
      .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with a single newline
      .trim();
    
    // Truncate if too long
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '... [truncated]';
    }
    
    return content;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Failed to fetch page: ${error.response.status} ${error.response.statusText}`);
    }
    throw error;
  }
} 