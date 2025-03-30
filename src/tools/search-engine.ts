import * as childProcess from 'child_process';
import axios from 'axios';

interface SearchEngineInput {
  query: string;
  max_results?: number;
}

interface SearchEngineResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

/**
 * Create a function to handle the search engine tool
 */
export function createSearchEngineTool() {
  return async (input: SearchEngineInput): Promise<SearchEngineResponse> => {
    const { query, max_results = 5 } = input;
    
    try {
      // For demo purposes, we'll use the Python tool with child_process first
      // While also implementing a native version as a fallback
      try {
        const { spawn } = childProcess;
        
        const args = [
          './tools/search_engine.py',
          query,
          '--max-results', max_results.toString()
        ];
        
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
              console.error(`Search engine error: ${errorOutput}`);
              console.warn('Falling back to native implementation...');
              // Don't reject, we'll try the native implementation
              throw new Error(`Search engine process exited with code ${code}`);
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
        console.info('Using native search engine implementation');
        const results = await searchWeb(query, max_results);
        
        // Format the results
        const formattedResults = results.map(result => 
          `URL: ${result.url}\nTitle: ${result.title}\nSnippet: ${result.snippet}`
        ).join('\n\n');
        
        return {
          content: [
            {
              type: 'text',
              text: formattedResults || 'No search results found.',
            },
          ],
        };
      }
    } catch (error) {
      console.error('Error in search engine tool:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error searching the web: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  };
}

/**
 * Native implementation of web search using a public API
 * Note: This uses DuckDuckGo API through a proxy, as there's no official API
 */
async function searchWeb(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  try {
    // Use DuckDuckGo API through a public proxy
    // Note: In a production environment, you'd want to use a more reliable and
    // properly authorized search API like Google, Bing, etc.
    const encodedQuery = encodeURIComponent(query);
    const response = await axios.get(`https://api.duckduckgo.com/?q=${encodedQuery}&format=json`);
    
    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Invalid response from search API');
    }
    
    // Extract results from DuckDuckGo response
    const results: SearchResult[] = [];
    
    // Add abstract result if available
    if (response.data.AbstractText && response.data.AbstractURL) {
      results.push({
        url: response.data.AbstractURL,
        title: response.data.Heading || 'Abstract',
        snippet: response.data.AbstractText,
      });
    }
    
    // Add related topics
    if (Array.isArray(response.data.RelatedTopics)) {
      for (const topic of response.data.RelatedTopics) {
        if (results.length >= maxResults) break;
        
        if (topic.Text && topic.FirstURL) {
          results.push({
            url: topic.FirstURL,
            title: topic.Text.split(' - ')[0] || 'Related Topic',
            snippet: topic.Text,
          });
        }
      }
    }
    
    // Fallback if we still have no results
    if (results.length === 0) {
      // In a real implementation, we would use another search API as fallback
      throw new Error('No search results found through DuckDuckGo API');
    }
    
    // Limit results
    return results.slice(0, maxResults);
  } catch (error) {
    console.error('Error in native search implementation:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Search API error: ${error.response.status} ${error.response.statusText}`);
    }
    throw error;
  }
} 