/**
 * AI-based tools for the Ultimate Self-Evolving Cursor MCP
 * Includes LLM integrations, vision capabilities, and more
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { spawn } = require('child_process');

// Tool definitions
const aiTools = [
  {
    name: "query_llm",
    description: "Query a large language model with a prompt",
    schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The prompt to send to the LLM"
        },
        provider: {
          type: "string",
          description: "The LLM provider to use",
          enum: ["openai", "anthropic", "deepseek", "gemini", "local", "auto"],
          default: "anthropic"
        },
        model: {
          type: "string",
          description: "Optional specific model to use"
        },
        max_tokens: {
          type: "number",
          description: "Maximum number of tokens in the response",
          default: 1000
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "image_analysis",
    description: "Analyze an image using computer vision capabilities",
    schema: {
      type: "object",
      properties: {
        image_path: {
          type: "string",
          description: "The path to the image file"
        },
        task: {
          type: "string",
          description: "The vision task to perform",
          enum: ["describe", "detect_objects", "read_text", "answer_question"],
          default: "describe"
        },
        question: {
          type: "string",
          description: "Question about the image (required for 'answer_question' task)"
        }
      },
      required: ["image_path"]
    }
  },
  {
    name: "take_screenshot",
    description: "Take a screenshot of a webpage",
    schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the webpage to screenshot"
        },
        output_path: {
          type: "string",
          description: "The path where to save the screenshot"
        },
        width: {
          type: "number",
          description: "Viewport width in pixels",
          default: 1280
        },
        height: {
          type: "number",
          description: "Viewport height in pixels",
          default: 800
        },
        full_page: {
          type: "boolean",
          description: "Whether to capture the full page or just the viewport",
          default: true
        },
        wait_for: {
          type: "number",
          description: "Time to wait in ms before taking the screenshot",
          default: 1000
        }
      },
      required: ["url", "output_path"]
    }
  },
  {
    name: "text_to_speech",
    description: "Convert text to speech audio",
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to convert to speech"
        },
        output_path: {
          type: "string",
          description: "The path where to save the audio file"
        },
        voice: {
          type: "string",
          description: "The voice to use",
          default: "default"
        },
        rate: {
          type: "number",
          description: "The speech rate",
          default: 1.0
        }
      },
      required: ["text", "output_path"]
    }
  }
];

// Check if the Python environment is available
function isPythonEnvironmentAvailable() {
  try {
    const output = execSync('which python3 || which python').toString().trim();
    return !!output;
  } catch (error) {
    return false;
  }
}

// Check if a Python package is installed
function isPythonPackageInstalled(packageName) {
  try {
    execSync(`python3 -c "import ${packageName}" 2>/dev/null || python -c "import ${packageName}" 2>/dev/null`);
    return true;
  } catch (error) {
    return false;
  }
}

// Run Python script with input and get output
async function runPythonScript(scriptPath, args = {}) {
  return new Promise((resolve, reject) => {
    const pythonCmd = isPythonEnvironmentAvailable() ? (fs.existsSync('/usr/bin/python3') ? 'python3' : 'python') : null;
    
    if (!pythonCmd) {
      reject(new Error('Python environment not available'));
      return;
    }
    
    // Check if we're in a virtual environment
    const pythonPath = process.env.VIRTUAL_ENV 
      ? path.join(process.env.VIRTUAL_ENV, 'bin', 'python')
      : pythonCmd;
    
    // Execute the Python script
    const pythonProcess = spawn(pythonPath, [scriptPath, JSON.stringify(args)]);
    
    let stdoutData = '';
    let stderrData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderrData}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdoutData.trim());
        resolve(result);
      } catch (error) {
        // If it's not JSON, just return the raw output
        resolve({ output: stdoutData.trim() });
      }
    });
  });
}

// Query LLM using the appropriate Python tool
async function queryLLM(prompt, provider = 'anthropic', model = null, maxTokens = 1000) {
  const toolsDir = path.join(__dirname, '..', '..', 'tools');
  const llmApiScript = path.join(toolsDir, 'llm_api.py');
  
  if (!fs.existsSync(llmApiScript)) {
    throw new Error(`LLM API script not found at ${llmApiScript}`);
  }
  
  try {
    const args = {
      prompt: prompt,
      provider: provider,
      max_tokens: maxTokens
    };
    
    if (model) {
      args.model = model;
    }
    
    return await runPythonScript(llmApiScript, args);
  } catch (error) {
    throw new Error(`Failed to query LLM: ${error.message}`);
  }
}

// Take a screenshot of a webpage
async function takeScreenshot(url, outputPath, width = 1280, height = 800, fullPage = true, waitFor = 1000) {
  const toolsDir = path.join(__dirname, '..', '..', 'tools');
  const screenshotScript = path.join(toolsDir, 'screenshot_utils.py');
  
  if (!fs.existsSync(screenshotScript)) {
    throw new Error(`Screenshot script not found at ${screenshotScript}`);
  }
  
  try {
    const args = {
      url: url,
      output: outputPath,
      width: width,
      height: height,
      full_page: fullPage,
      wait_for: waitFor
    };
    
    return await runPythonScript(screenshotScript, args);
  } catch (error) {
    throw new Error(`Failed to take screenshot: ${error.message}`);
  }
}

// Analyze image using LLM with vision capabilities
async function analyzeImage(imagePath, task = 'describe', question = null) {
  const toolsDir = path.join(__dirname, '..', '..', 'tools');
  const llmApiScript = path.join(toolsDir, 'llm_api.py');
  
  if (!fs.existsSync(llmApiScript)) {
    throw new Error(`LLM API script not found at ${llmApiScript}`);
  }
  
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found at ${imagePath}`);
  }
  
  try {
    let prompt;
    
    switch (task) {
      case 'describe':
        prompt = 'Describe this image in detail.';
        break;
      case 'detect_objects':
        prompt = 'List all objects visible in this image.';
        break;
      case 'read_text':
        prompt = 'Read and transcribe any text visible in this image.';
        break;
      case 'answer_question':
        if (!question) {
          throw new Error('Question is required for answer_question task');
        }
        prompt = question;
        break;
      default:
        prompt = 'Describe this image.';
    }
    
    const args = {
      prompt: prompt,
      provider: 'openai', // Currently using OpenAI for vision tasks
      image_path: imagePath
    };
    
    return await runPythonScript(llmApiScript, args);
  } catch (error) {
    throw new Error(`Failed to analyze image: ${error.message}`);
  }
}

// Convert text to speech
async function textToSpeech(text, outputPath, voice = 'default', rate = 1.0) {
  // This is just a placeholder implementation
  // In a real implementation, you would use a TTS service or library
  
  // Check if the output directory exists, create it if not
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  try {
    // Using say command on macOS as a simple example
    if (process.platform === 'darwin') {
      const voiceFlag = voice !== 'default' ? `-v "${voice}"` : '';
      const rateFlag = `-r ${rate * 200}`; // Convert rate to say's words per minute
      
      execSync(`say ${voiceFlag} ${rateFlag} -o "${outputPath}" "${text.replace(/"/g, '\\"')}"`);
      
      return { output_path: outputPath };
    } else if (process.platform === 'linux') {
      // Try using espeak on Linux
      execSync(`espeak -w "${outputPath}" "${text.replace(/"/g, '\\"')}"`);
      return { output_path: outputPath };
    } else {
      throw new Error(`Text-to-speech not supported on ${process.platform}`);
    }
  } catch (error) {
    throw new Error(`Failed to convert text to speech: ${error.message}`);
  }
}

// Tool implementation handlers
async function handleAITools(toolName, params) {
  try {
    switch (toolName) {
      case "query_llm": {
        const { prompt, provider = 'anthropic', model = null, max_tokens = 1000 } = params;
        
        if (!prompt) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Prompt is required"
              }
            ]
          };
        }
        
        try {
          const result = await queryLLM(prompt, provider, model, max_tokens);
          
          return {
            content: [
              {
                type: "text",
                text: result.response || result.output || "No response from LLM"
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `LLM query failed: ${error.message}`
              }
            ]
          };
        }
      }
      
      case "image_analysis": {
        const { image_path, task = 'describe', question = null } = params;
        
        if (!image_path) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Image path is required"
              }
            ]
          };
        }
        
        if (task === 'answer_question' && !question) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Question is required for answer_question task"
              }
            ]
          };
        }
        
        try {
          const result = await analyzeImage(image_path, task, question);
          
          return {
            content: [
              {
                type: "text",
                text: result.response || result.output || "No analysis result"
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Image analysis failed: ${error.message}`
              }
            ]
          };
        }
      }
      
      case "take_screenshot": {
        const { 
          url, 
          output_path, 
          width = 1280, 
          height = 800,
          full_page = true,
          wait_for = 1000
        } = params;
        
        if (!url || !output_path) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "URL and output path are required"
              }
            ]
          };
        }
        
        try {
          const result = await takeScreenshot(url, output_path, width, height, full_page, wait_for);
          
          return {
            content: [
              {
                type: "text",
                text: `Screenshot saved to: ${output_path}`
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Screenshot failed: ${error.message}`
              }
            ]
          };
        }
      }
      
      case "text_to_speech": {
        const { text, output_path, voice = 'default', rate = 1.0 } = params;
        
        if (!text || !output_path) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Text and output path are required"
              }
            ]
          };
        }
        
        try {
          const result = await textToSpeech(text, output_path, voice, rate);
          
          return {
            content: [
              {
                type: "text",
                text: `Speech saved to: ${result.output_path}`
              }
            ]
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Text-to-speech failed: ${error.message}`
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
              text: `Unknown AI tool: ${toolName}`
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
          text: `Error in AI tools: ${error.message}`
        }
      ]
    };
  }
}

module.exports = {
  aiTools,
  handleAITools
}; 