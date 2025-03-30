import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { promisify } from 'util';

const exec = promisify(childProcess.exec);

interface LLMInput {
  prompt: string;
  provider?: 'openai' | 'anthropic' | 'gemini' | 'local';
  image_path?: string;
}

interface LLMResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

/**
 * Create the LLM tool function
 */
export function createLLMTool() {
  return async (input: LLMInput): Promise<LLMResponse> => {
    const { prompt, provider = 'openai', image_path } = input;
    
    try {
      // Build command to call the Python LLM API
      let cmd = `venv/bin/python3 tools/llm_api.py --prompt "${prompt.replace(/"/g, '\\"')}" --provider "${provider}"`;
      
      // Add image path if provided
      if (image_path && fs.existsSync(image_path)) {
        cmd += ` --image ${image_path}`;
      }
      
      // Execute the command
      const { stdout, stderr } = await exec(cmd);
      
      if (stderr) {
        console.error('LLM API stderr:', stderr);
      }
      
      // Return the response
      return {
        content: [
          {
            type: 'text',
            text: stdout.trim(),
          },
        ],
      };
    } catch (error) {
      console.error('Error calling LLM API:', error);
      
      // Check if Python tools directory exists
      if (!fs.existsSync(path.join(process.cwd(), 'tools', 'llm_api.py'))) {
        return {
          content: [
            {
              type: 'text',
              text: 'LLM API tool not found. Make sure the Python tools directory exists and contains llm_api.py.',
            },
          ],
        };
      }
      
      // Check if virtual environment exists
      if (!fs.existsSync(path.join(process.cwd(), 'venv'))) {
        return {
          content: [
            {
              type: 'text',
              text: 'Python virtual environment not found. Make sure to run "python -m venv venv" and install requirements.',
            },
          ],
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Error calling LLM API: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  };
}
