/**
 * Web-based tools for the Ultimate Self-Evolving Cursor MCP
 * Includes web scraping, search, and more
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Tool definitions
const webTools = [
  {
    name: "web_scrape",
    description: "Scrape content from a web page",
    schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to scrape"
        },
        selector: {
          type: "string",
          description: "Optional CSS selector to extract specific content"
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 10000)"
        }
      },
      required: ["url"]
    }
  },
  {
    name: "web_search",
    description: "Search the web for information",
    schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 5)"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "web_crawler",
    description: "Crawl a website to extract structured information from multiple pages",
    schema: {
      type: "object",
      properties: {
        start_url: {
          type: "string",
          description: "The starting URL for the crawler"
        },
        max_pages: {
          type: "number",
          description: "Maximum number of pages to crawl (default: 5, max: 20)"
        },
        stay_within_domain: {
          type: "boolean",
          description: "Only follow links within the same domain (default: true)"
        },
        link_selector: {
          type: "string",
          description: "CSS selector for finding links to follow (default: 'a')"
        },
        content_selector: {
          type: "string", 
          description: "CSS selector for extracting content from each page (optional)"
        },
        extraction_pattern: {
          type: "string",
          description: "Type of data to extract: 'article', 'product', 'list', or 'custom'"
        },
        max_depth: {
          type: "number",
          description: "Maximum link depth to crawl (default: 2)"
        }
      },
      required: ["start_url"]
    }
  },
  {
    name: "semantic_search",
    description: "Search the web and extract semantically relevant information based on a query",
    schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query"
        },
        depth: {
          type: "string",
          description: "Depth of analysis: 'basic', 'detailed', or 'comprehensive'",
          enum: ["basic", "detailed", "comprehensive"],
          default: "detailed"
        },
        sources: {
          type: "number",
          description: "Number of sources to analyze (default: 3, max: 5)"
        },
        focus: {
          type: "string",
          description: "What to focus on: 'recent', 'authoritative', 'diverse', or 'specific'",
          enum: ["recent", "authoritative", "diverse", "specific"],
          default: "authoritative"
        },
        extract_format: {
          type: "string",
          description: "Format to return results: 'summary', 'quotes', 'structured', or 'comparative'",
          enum: ["summary", "quotes", "structured", "comparative"],
          default: "summary"
        }
      },
      required: ["query"]
    }
  }
];

// Helper function to make HTTP requests
function fetchUrl(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = protocol.get(url, {
      timeout: timeout,
      headers: {
        'User-Agent': 'Ultimate-Cursor-MCP/1.0',
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Request failed with status code ${res.statusCode}`));
        return;
      }
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data);
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeout}ms`));
    });
  });
}

// Search engine abstraction (simplified DuckDuckGo API)
async function searchWeb(query, limit = 5) {
  try {
    // Encode the query
    const encodedQuery = encodeURIComponent(query);
    
    // Use DuckDuckGo's Lite version for simplicity
    const url = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;
    
    // Fetch the search results page
    const html = await fetchUrl(url);
    
    // Extract results (very simplified - in a real implementation, use a proper HTML parser)
    const results = [];
    let startIndex = 0;
    
    // Very basic extraction of links from the HTML response
    for (let i = 0; i < limit; i++) {
      const linkStart = html.indexOf('<a class="result-link" href="', startIndex);
      if (linkStart === -1) break;
      
      const hrefStart = linkStart + '<a class="result-link" href="'.length;
      const hrefEnd = html.indexOf('"', hrefStart);
      const url = html.substring(hrefStart, hrefEnd);
      
      const titleStart = html.indexOf('>', hrefEnd) + 1;
      const titleEnd = html.indexOf('</a>', titleStart);
      const title = html.substring(titleStart, titleEnd).trim();
      
      // Look for a snippet after the link
      const snippetStart = html.indexOf('<div class="result-snippet">', titleEnd);
      const snippetContentStart = snippetStart + '<div class="result-snippet">'.length;
      const snippetEnd = html.indexOf('</div>', snippetContentStart);
      const snippet = snippetStart !== -1 ? 
        html.substring(snippetContentStart, snippetEnd).trim() : 
        "No description available";
      
      results.push({
        title,
        url,
        snippet
      });
      
      startIndex = snippetEnd;
    }
    
    return results;
  } catch (error) {
    throw new Error(`Search failed: ${error.message}`);
  }
}

// Extract text content from HTML (simplified)
function extractTextFromHtml(html, selector = null) {
  // Remove scripts and styles
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  
  // Replace HTML tags with space
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// Extract links from HTML
function extractLinksFromHtml(html, baseUrl, linkSelector = 'a') {
  const links = [];
  let startIndex = 0;
  
  // Very simplified link extraction - a real implementation would use a proper HTML parser
  while (true) {
    const linkStart = html.indexOf('<a ', startIndex);
    if (linkStart === -1) break;
    
    const hrefStart = html.indexOf('href="', linkStart);
    if (hrefStart === -1 || hrefStart > html.indexOf('>', linkStart)) {
      startIndex = linkStart + 1;
      continue;
    }
    
    const hrefValueStart = hrefStart + 'href="'.length;
    const hrefEnd = html.indexOf('"', hrefValueStart);
    if (hrefEnd === -1) {
      startIndex = linkStart + 1;
      continue;
    }
    
    let href = html.substring(hrefValueStart, hrefEnd).trim();
    
    // Skip non-HTTP links like mailto: or javascript:
    if (href.startsWith('http') || href.startsWith('/')) {
      // Convert relative URLs to absolute
      if (href.startsWith('/')) {
        const url = new URL(baseUrl);
        href = `${url.protocol}//${url.host}${href}`;
      }
      
      links.push(href);
    }
    
    startIndex = hrefEnd;
  }
  
  // Remove duplicates
  return [...new Set(links)];
}

// Check if a URL is within the same domain as the base URL
function isSameDomain(url, baseUrl) {
  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);
    return urlObj.hostname === baseUrlObj.hostname;
  } catch (error) {
    return false;
  }
}

// Web crawler implementation
async function crawlWebsite(startUrl, maxPages = 5, stayWithinDomain = true, linkSelector = 'a', contentSelector = null, extractionPattern = null, maxDepth = 2) {
  const MAX_ALLOWED_PAGES = 20; // Hard limit for safety
  const actualMaxPages = Math.min(maxPages, MAX_ALLOWED_PAGES);
  
  // Set to track visited URLs
  const visited = new Set();
  // Array to store crawled pages
  const crawledPages = [];
  // Queue of URLs to visit with their depth
  const queue = [{ url: startUrl, depth: 0 }];
  
  while (queue.length > 0 && crawledPages.length < actualMaxPages) {
    const { url, depth } = queue.shift();
    
    // Skip if already visited or max depth exceeded
    if (visited.has(url) || depth > maxDepth) continue;
    
    // Mark as visited
    visited.add(url);
    
    try {
      // Fetch the page
      const html = await fetchUrl(url);
      
      // Extract content based on selector or extraction pattern
      let pageContent;
      
      if (extractionPattern === 'article') {
        // Extract article content (simplified)
        pageContent = extractArticleContent(html);
      } else if (extractionPattern === 'product') {
        // Extract product information (simplified)
        pageContent = extractProductInfo(html);
      } else if (extractionPattern === 'list') {
        // Extract list items (simplified)
        pageContent = extractListItems(html);
      } else if (contentSelector) {
        // Custom extraction with selector
        pageContent = extractWithSelector(html, contentSelector);
      } else {
        // Default to plain text extraction
        pageContent = extractTextFromHtml(html);
        
        // Trim long content
        if (pageContent.length > 5000) {
          pageContent = pageContent.substring(0, 5000) + "... [content truncated]";
        }
      }
      
      // Add to crawled pages
      crawledPages.push({
        url,
        depth,
        title: extractTitle(html),
        content: pageContent
      });
      
      // Extract links for the next level if not at max depth
      if (depth < maxDepth) {
        const links = extractLinksFromHtml(html, url, linkSelector);
        
        for (const link of links) {
          // Only add links that meet our criteria
          if (!visited.has(link) && 
              (!stayWithinDomain || isSameDomain(link, startUrl))) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
      
    } catch (error) {
      console.error(`Error crawling ${url}: ${error.message}`);
      // Continue with next URL despite errors
    }
    
    // Add a small delay to avoid overloading servers
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return {
    start_url: startUrl,
    pages_crawled: crawledPages.length,
    pages_attempted: visited.size,
    max_depth_reached: Math.max(...crawledPages.map(p => p.depth)),
    results: crawledPages
  };
}

// Extract article content (simplified implementation)
function extractArticleContent(html) {
  // Look for common article containers
  let articleContent = '';
  
  // Try to find article or main content tags
  const articleTags = ['<article', '<main', '<div class="content"', '<div class="article"', '<div class="post"'];
  
  for (const tag of articleTags) {
    const startIndex = html.indexOf(tag);
    if (startIndex !== -1) {
      // Find the closing tag
      const tagName = tag.substring(1, tag.indexOf(' ') > 0 ? tag.indexOf(' ') : tag.length);
      const endTag = `</${tagName}>`;
      const endIndex = html.indexOf(endTag, startIndex + tag.length);
      
      if (endIndex !== -1) {
        articleContent = html.substring(startIndex, endIndex + endTag.length);
        break;
      }
    }
  }
  
  // If no article container found, try to identify the main content area heuristically
  if (!articleContent) {
    // Simplified: just take content after first <h1> and before the first <footer> or end
    const h1Index = html.indexOf('<h1');
    if (h1Index !== -1) {
      const contentStart = html.indexOf('>', h1Index) + 1;
      const footerIndex = html.indexOf('<footer');
      const contentEnd = footerIndex !== -1 ? footerIndex : html.length;
      articleContent = html.substring(contentStart, contentEnd);
    }
  }
  
  // Fall back to whole body if we couldn't identify an article
  if (!articleContent) {
    const bodyStart = html.indexOf('<body');
    if (bodyStart !== -1) {
      const contentStart = html.indexOf('>', bodyStart) + 1;
      const bodyEnd = html.indexOf('</body>', contentStart);
      articleContent = html.substring(contentStart, bodyEnd !== -1 ? bodyEnd : html.length);
    } else {
      articleContent = html;
    }
  }
  
  // Extract plain text from the article HTML
  return extractTextFromHtml(articleContent);
}

// Extract product information (simplified implementation)
function extractProductInfo(html) {
  // Simplified product info extraction
  const product = {};
  
  // Extract title - often in h1 tags
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  product.title = titleMatch ? extractTextFromHtml(titleMatch[1]) : '';
  
  // Extract price - look for elements with price-related classes or IDs
  const priceRegex = /class="[^"]*(?:price|cost)[^"]*"[^>]*>(.*?)<\/|\$\s*\d+(?:\.\d{2})?/gi;
  const priceMatch = html.match(priceRegex);
  if (priceMatch) {
    product.price = extractTextFromHtml(priceMatch[0]).trim();
  }
  
  // Look for description
  const descriptionPatterns = [
    /<div[^>]*(?:id|class)="[^"]*description[^"]*"[^>]*>(.*?)<\/div>/is,
    /<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i
  ];
  
  for (const pattern of descriptionPatterns) {
    const match = html.match(pattern);
    if (match) {
      product.description = extractTextFromHtml(match[1]).trim();
      break;
    }
  }
  
  // Convert to text representation
  let productText = `Product Information:\n`;
  
  if (product.title) productText += `Title: ${product.title}\n`;
  if (product.price) productText += `Price: ${product.price}\n`;
  if (product.description) productText += `Description: ${product.description}\n`;
  
  return productText;
}

// Extract list items (simplified implementation)
function extractListItems(html) {
  // Find all list items
  const listItems = [];
  let startIndex = 0;
  
  // Look for ul/ol and extract li elements
  while (true) {
    const listStart = html.indexOf('<ul', startIndex);
    const orderedListStart = html.indexOf('<ol', startIndex);
    
    // No more lists found
    if (listStart === -1 && orderedListStart === -1) break;
    
    // Determine which type of list comes first
    const nextListIndex = listStart === -1 ? orderedListStart : 
                         orderedListStart === -1 ? listStart :
                         Math.min(listStart, orderedListStart);
    
    const isOrdered = nextListIndex === orderedListStart;
    const listTag = isOrdered ? 'ol' : 'ul';
    const listEndTag = `</${listTag}>`;
    
    // Find the end of the list
    const listEnd = html.indexOf(listEndTag, nextListIndex);
    if (listEnd === -1) {
      startIndex = nextListIndex + 1;
      continue;
    }
    
    // Extract the list content
    const listContent = html.substring(nextListIndex, listEnd + listEndTag.length);
    
    // Extract list items
    let itemStartIndex = 0;
    const items = [];
    
    while (true) {
      const itemStart = listContent.indexOf('<li', itemStartIndex);
      if (itemStart === -1) break;
      
      const itemContentStart = listContent.indexOf('>', itemStart) + 1;
      const itemEnd = listContent.indexOf('</li>', itemContentStart);
      
      if (itemEnd === -1) {
        itemStartIndex = itemStart + 1;
        continue;
      }
      
      const itemContent = listContent.substring(itemContentStart, itemEnd);
      items.push(extractTextFromHtml(itemContent).trim());
      
      itemStartIndex = itemEnd;
    }
    
    if (items.length > 0) {
      listItems.push({
        type: isOrdered ? 'ordered' : 'unordered',
        items
      });
    }
    
    startIndex = listEnd;
  }
  
  // Format the result
  if (listItems.length === 0) {
    return "No lists found on the page.";
  }
  
  let result = "Extracted Lists:\n\n";
  
  listItems.forEach((list, index) => {
    result += `List ${index + 1} (${list.type}):\n`;
    list.items.forEach((item, itemIndex) => {
      result += `${list.type === 'ordered' ? (itemIndex + 1) + '.' : '•'} ${item}\n`;
    });
    result += '\n';
  });
  
  return result;
}

// Extract content with a specific selector (simplified)
function extractWithSelector(html, selector) {
  // This is a simplified implementation since we don't have a full DOM parser
  // In a real implementation, use a library like cheerio
  
  // Here we'll just do a basic implementation for common selectors
  if (selector.startsWith('#')) {
    // ID selector
    const idName = selector.substring(1);
    const pattern = new RegExp(`<[^>]+id=["']${idName}["'][^>]*>(.*?)<`, 'is');
    const match = html.match(pattern);
    return match ? extractTextFromHtml(match[1]) : "No content found with this selector";
  } else if (selector.startsWith('.')) {
    // Class selector
    const className = selector.substring(1);
    const pattern = new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>(.*?)<`, 'is');
    const match = html.match(pattern);
    return match ? extractTextFromHtml(match[1]) : "No content found with this selector";
  } else {
    // Tag selector
    const pattern = new RegExp(`<${selector}[^>]*>(.*?)</${selector}>`, 'is');
    const match = html.match(pattern);
    return match ? extractTextFromHtml(match[1]) : "No content found with this selector";
  }
}

// Extract page title
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return titleMatch ? extractTextFromHtml(titleMatch[1]).trim() : "Untitled Page";
}

// Perform semantic search by crawling multiple results from a search
async function performSemanticSearch(query, depth = 'detailed', sources = 3, focus = 'authoritative', extractFormat = 'summary') {
  const MAX_SOURCES = 5; // Hard limit for safety
  const actualSources = Math.min(sources, MAX_SOURCES);
  
  try {
    // First, search the web
    const searchResults = await searchWeb(query, actualSources * 2); // Get more results in case some fail
    
    // Track the content from each source
    const sourceContents = [];
    
    // Crawl each search result to get detailed information
    for (const result of searchResults) {
      if (sourceContents.length >= actualSources) break;
      
      try {
        // Fetch the page content
        const html = await fetchUrl(result.url);
        
        // Extract what we need based on depth
        let content;
        
        if (depth === 'basic') {
          // Basic extraction - just the main text
          content = extractTextFromHtml(html);
          // Truncate to avoid too much content
          if (content.length > 3000) {
            content = content.substring(0, 3000) + "... [content truncated]";
          }
        } else if (depth === 'detailed') {
          // Try to extract article content for a more focused view
          content = extractArticleContent(html);
          // Truncate if needed
          if (content.length > 5000) {
            content = content.substring(0, 5000) + "... [content truncated]";
          }
        } else if (depth === 'comprehensive') {
          // For comprehensive, also crawl internal links one level deep
          const pageInfo = await crawlWebsite(result.url, 3, true, 'a', null, null, 1);
          content = pageInfo.results.map(p => `${p.title}\n${p.content}`).join('\n\n-----\n\n');
          // Truncate if needed
          if (content.length > 8000) {
            content = content.substring(0, 8000) + "... [content truncated]";
          }
        }
        
        // Add this source to our collection
        sourceContents.push({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          content: content
        });
        
      } catch (error) {
        console.error(`Error processing search result ${result.url}: ${error.message}`);
        // Continue to the next result
      }
      
      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Organize the content based on the requested format
    let formattedResult = '';
    
    if (extractFormat === 'summary') {
      // Create a summarized version
      formattedResult = `Semantic Search Results for: "${query}"\n\n`;
      
      sourceContents.forEach((source, index) => {
        formattedResult += `Source ${index + 1}: ${source.title}\n`;
        formattedResult += `URL: ${source.url}\n\n`;
        formattedResult += `${source.content.substring(0, 500)}...\n\n`;
      });
      
    } else if (extractFormat === 'quotes') {
      // Extract key quotes that seem relevant to the query
      formattedResult = `Key Quotes for: "${query}"\n\n`;
      
      sourceContents.forEach((source, index) => {
        formattedResult += `Source ${index + 1}: ${source.title} (${source.url})\n\n`;
        
        // Very simplified quote extraction - look for sentences containing query terms
        const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 3);
        const sentences = source.content.split(/[.!?]+/);
        
        const relevantSentences = sentences.filter(sentence => {
          const lowerSentence = sentence.toLowerCase();
          return queryTerms.some(term => lowerSentence.includes(term));
        });
        
        const quotes = relevantSentences.slice(0, 3).map(s => s.trim());
        quotes.forEach(quote => {
          if (quote) formattedResult += `"${quote}"\n\n`;
        });
      });
      
    } else if (extractFormat === 'structured') {
      // Provide a structured analysis
      formattedResult = `Structured Analysis: "${query}"\n\n`;
      
      // Summary section
      formattedResult += "## Summary\n\n";
      formattedResult += `Analysis based on ${sourceContents.length} sources related to "${query}"\n\n`;
      
      // Source details
      formattedResult += "## Sources\n\n";
      sourceContents.forEach((source, index) => {
        formattedResult += `${index + 1}. "${source.title}" - ${source.url}\n`;
      });
      formattedResult += "\n";
      
      // Main content
      formattedResult += "## Key Content\n\n";
      sourceContents.forEach((source, index) => {
        formattedResult += `### Source ${index + 1}: ${source.title}\n\n`;
        // Extract a few paragraphs
        const paragraphs = source.content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        paragraphs.slice(0, 2).forEach(p => {
          formattedResult += `${p.trim()}\n\n`;
        });
      });
      
    } else if (extractFormat === 'comparative') {
      // Create a comparative analysis
      formattedResult = `Comparative Analysis: "${query}"\n\n`;
      
      // List all sources first
      formattedResult += "## Sources Compared\n\n";
      sourceContents.forEach((source, index) => {
        formattedResult += `${index + 1}. ${source.title} (${source.url})\n`;
      });
      formattedResult += "\n";
      
      // Extract common topics based on simple keyword frequency
      const wordFrequency = {};
      sourceContents.forEach(source => {
        const words = source.content.toLowerCase()
          .split(/\W+/)
          .filter(word => word.length > 4);
        
        words.forEach(word => {
          wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        });
      });
      
      // Find common topics (words that appear in most sources)
      const commonTopics = Object.entries(wordFrequency)
        .filter(([_, count]) => count >= Math.max(2, Math.floor(sourceContents.length * 0.6)))
        .map(([word]) => word)
        .slice(0, 5);
      
      // Compare sources on common topics
      formattedResult += "## Common Topics\n\n";
      commonTopics.forEach(topic => {
        formattedResult += `### Topic: ${topic}\n\n`;
        
        sourceContents.forEach((source, index) => {
          const sentences = source.content.split(/[.!?]+/);
          
          // Find sentences mentioning this topic
          const relevantSentences = sentences
            .filter(s => s.toLowerCase().includes(topic))
            .slice(0, 1)
            .map(s => s.trim());
          
          if (relevantSentences.length > 0) {
            formattedResult += `Source ${index + 1}: ${relevantSentences[0]}\n\n`;
          }
        });
      });
    }
    
    return formattedResult;
  } catch (error) {
    throw new Error(`Semantic search failed: ${error.message}`);
  }
}

// Tool implementation handlers
async function handleWebTools(toolName, params) {
  try {
    switch (toolName) {
      case "web_scrape": {
        const { url, selector, timeout = 10000 } = params;
        
        if (!url) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "URL is required"
              }
            ]
          };
        }
        
        try {
          const html = await fetchUrl(url, timeout);
          const text = extractTextFromHtml(html, selector);
          
          // Truncate very long content to 10000 characters
          const truncated = text.length > 10000 ? 
            text.substring(0, 10000) + "... [content truncated]" : 
            text;
          
          return {
            content: [
              {
                type: "text",
                text: truncated
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error scraping URL: ${error.message}`
              }
            ]
          };
        }
      }
      
      case "web_search": {
        const { query, limit = 5 } = params;
        
        if (!query) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Search query is required"
              }
            ]
          };
        }
        
        try {
          const results = await searchWeb(query, limit);
          
          const formattedResults = results.map((result, index) => 
            `${index + 1}. ${result.title}\n   URL: ${result.url}\n   ${result.snippet}\n`
          ).join('\n');
          
          return {
            content: [
              {
                type: "text",
                text: `Search results for "${query}":\n\n${formattedResults}`
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error searching: ${error.message}`
              }
            ]
          };
        }
      }
      
      case "web_crawler": {
        const { 
          start_url,
          max_pages = 5,
          stay_within_domain = true,
          link_selector = 'a',
          content_selector = null,
          extraction_pattern = null,
          max_depth = 2
        } = params;
        
        if (!start_url) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Starting URL is required"
              }
            ]
          };
        }
        
        try {
          const crawlResults = await crawlWebsite(
            start_url,
            max_pages,
            stay_within_domain,
            link_selector,
            content_selector,
            extraction_pattern,
            max_depth
          );
          
          // Format crawler results for display
          let resultText = `Web Crawler Results - ${crawlResults.pages_crawled} pages crawled\n\n`;
          
          resultText += `Starting URL: ${crawlResults.start_url}\n`;
          resultText += `Pages crawled: ${crawlResults.pages_crawled}\n`;
          resultText += `Pages attempted: ${crawlResults.pages_attempted}\n`;
          resultText += `Maximum depth reached: ${crawlResults.max_depth_reached}\n\n`;
          
          // Show summary of each page
          crawlResults.results.forEach((page, index) => {
            resultText += `Page ${index + 1}: ${page.title}\n`;
            resultText += `URL: ${page.url}\n`;
            resultText += `Depth: ${page.depth}\n`;
            
            // Preview of content (first 200 chars)
            const contentPreview = page.content.substring(0, 200).trim();
            resultText += `Content preview: ${contentPreview}${contentPreview.length < page.content.length ? '...' : ''}\n\n`;
          });
          
          return {
            content: [
              {
                type: "text",
                text: resultText
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error crawling website: ${error.message}`
              }
            ]
          };
        }
      }
      
      case "semantic_search": {
        const { 
          query,
          depth = 'detailed',
          sources = 3,
          focus = 'authoritative',
          extract_format = 'summary'
        } = params;
        
        if (!query) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Search query is required"
              }
            ]
          };
        }
        
        try {
          const semanticResults = await performSemanticSearch(
            query,
            depth,
            sources,
            focus,
            extract_format
          );
          
          return {
            content: [
              {
                type: "text",
                text: semanticResults
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error performing semantic search: ${error.message}`
              }
            ]
          };
        }
      }
      
      default:
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Unknown web tool: ${toolName}`
            }
          ]
        };
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error processing web tool request: ${error.message}`
        }
      ]
    };
  }
}

module.exports = {
  webTools,
  handleWebTools
}; 