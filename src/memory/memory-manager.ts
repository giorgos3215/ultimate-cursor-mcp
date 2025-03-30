import * as fs from 'fs';
import * as path from 'path';

/**
 * MemoryManager provides persistent storage for the MCP
 * It handles saving/loading data and recording lessons learned
 */
export class MemoryManager {
  private memory: Record<string, Record<string, string>> = {};
  private memoryFilePath: string;
  private cursorRulesPath: string;
  
  constructor() {
    this.memoryFilePath = path.join(process.cwd(), 'memory.json');
    this.cursorRulesPath = path.join(process.cwd(), '.cursorrules');
    console.log(`MemoryManager initialized with path: ${this.memoryFilePath}`);
    this.loadMemory();
  }
  
  /**
   * Save a value to persistent memory
   */
  public async save(namespace: string, key: string, value: string): Promise<void> {
    console.log(`Saving to memory: namespace=${namespace}, key=${key}, value=${value}`);
    if (!this.memory[namespace]) {
      this.memory[namespace] = {};
    }
    
    this.memory[namespace][key] = value;
    await this.persistMemory();
  }
  
  /**
   * Get a value from memory
   */
  public get(namespace: string, key: string): string | undefined {
    console.log(`Getting from memory: namespace=${namespace}, key=${key}`);
    if (!this.memory[namespace]) {
      return undefined;
    }
    
    return this.memory[namespace][key];
  }
  
  /**
   * Get all values in a namespace
   */
  public getNamespace(namespace: string): Record<string, string> {
    return this.memory[namespace] || {};
  }
  
  /**
   * Delete a value from memory
   */
  public delete(namespace: string, key: string): void {
    if (this.memory[namespace] && this.memory[namespace][key]) {
      delete this.memory[namespace][key];
      this.persistMemory().catch(console.error);
    }
  }
  
  /**
   * Learn a lesson and update the .cursorrules file
   */
  public async learnLesson(lesson: string, category: string): Promise<void> {
    // Save to memory for our own tracking
    const timestamp = new Date().toISOString();
    await this.save('lessons', `lesson_${timestamp}`, `[${category}] ${lesson}`);
    
    // Update the .cursorrules file if it exists
    if (fs.existsSync(this.cursorRulesPath)) {
      try {
        let content = fs.readFileSync(this.cursorRulesPath, 'utf-8');
        
        // Find the Cursor learned section
        const cursorLearnedRegex = /## Cursor learned\s*\n/;
        const cursorLearnedMatch = content.match(cursorLearnedRegex);
        
        if (cursorLearnedMatch) {
          // Insert the new lesson after the Cursor learned heading
          const matchIndex = content.indexOf(cursorLearnedMatch[0]) + cursorLearnedMatch[0].length;
          
          // Format the lesson
          const formattedLesson = `- ${lesson}\n`;
          
          // Insert the lesson
          content = content.slice(0, matchIndex) + formattedLesson + content.slice(matchIndex);
          
          // Write back to file
          fs.writeFileSync(this.cursorRulesPath, content, 'utf-8');
          console.log(`Added lesson to .cursorrules: ${lesson}`);
        } else {
          // Cursor learned section not found, look for Lessons section instead
          const lessonsSectionRegex = /# Lessons\s*\n/;
          const lessonsSectionMatch = content.match(lessonsSectionRegex);
          
          if (lessonsSectionMatch) {
            // Add Cursor learned section after Lessons heading
            const matchIndex = content.indexOf(lessonsSectionMatch[0]) + lessonsSectionMatch[0].length;
            
            // Format the section with the lesson
            const formattedSection = `\n## Cursor learned\n\n- ${lesson}\n`;
            
            // Insert the section
            content = content.slice(0, matchIndex) + formattedSection + content.slice(matchIndex);
            
            // Write back to file
            fs.writeFileSync(this.cursorRulesPath, content, 'utf-8');
            console.log(`Added Cursor learned section to .cursorrules with lesson: ${lesson}`);
          } else {
            // Lessons section not found, append to the end
            content += `\n# Lessons\n\n## Cursor learned\n\n- ${lesson}\n`;
            fs.writeFileSync(this.cursorRulesPath, content, 'utf-8');
            console.log(`Added Lessons section to .cursorrules with lesson: ${lesson}`);
          }
        }
      } catch (error) {
        console.error('Error updating .cursorrules file:', error);
      }
    } else {
      console.error('.cursorrules file not found');
    }
  }
  
  /**
   * Load memory from disk
   */
  private loadMemory(): void {
    if (fs.existsSync(this.memoryFilePath)) {
      try {
        const data = fs.readFileSync(this.memoryFilePath, 'utf-8');
        this.memory = JSON.parse(data);
        console.log(`Loaded memory from ${this.memoryFilePath}`);
      } catch (error) {
        console.error('Error loading memory from file:', error);
        this.memory = {};
      }
    } else {
      console.log(`Memory file not found at ${this.memoryFilePath}, starting with empty memory`);
      this.memory = {};
    }
  }
  
  /**
   * Save memory to disk
   */
  private async persistMemory(): Promise<void> {
    try {
      const data = JSON.stringify(this.memory, null, 2);
      console.log(`Writing memory to ${this.memoryFilePath}`);
      console.log(`Current memory state: ${data}`);
      console.log(`Current directory: ${process.cwd()}`);
      console.log(`File path: ${this.memoryFilePath}`);
      
      // Check if the directory exists
      const directory = path.dirname(this.memoryFilePath);
      if (!fs.existsSync(directory)) {
        console.log(`Creating directory: ${directory}`);
        fs.mkdirSync(directory, { recursive: true });
      }
      
      // Write the file
      fs.writeFileSync(this.memoryFilePath, data, 'utf-8');
      console.log(`Memory successfully written to ${this.memoryFilePath}`);
    } catch (error) {
      console.error('Error persisting memory to file:', error);
      console.error(error instanceof Error ? error.stack : String(error));
    }
  }
}
