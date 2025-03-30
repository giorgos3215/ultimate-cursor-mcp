import { MemoryManager } from '../memory/memory-manager';
import * as fs from 'fs';
import * as path from 'path';

// Define the interfaces for our improvement mechanism
export interface UsagePattern {
  toolName: string;
  frequency: number;
  successRate: number;
  averageResponseTime: number;
}

export interface ToolUsageStats {
  patterns: UsagePattern[];
  lastAnalyzed: string;
}

export interface ImprovementSuggestion {
  toolName: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
  reason: string;
}

/**
 * Self-improvement mechanism that analyzes tool usage patterns
 * and suggests improvements to the MCP
 */
export class SelfImprovement {
  private memoryManager: MemoryManager;
  private usageStats: ToolUsageStats | null = null;
  private readonly STATS_KEY = 'tool_usage_stats';
  private readonly SUGGESTIONS_KEY = 'improvement_suggestions';
  private readonly NAMESPACE = 'self_evolution';
  
  constructor(memoryManager: MemoryManager) {
    this.memoryManager = memoryManager;
    this.loadUsageStats();
  }
  
  /**
   * Load usage statistics from memory
   */
  private async loadUsageStats(): Promise<void> {
    try {
      const stats = await this.memoryManager.get(this.STATS_KEY, this.NAMESPACE);
      if (stats) {
        this.usageStats = JSON.parse(stats);
      } else {
        // Initialize with empty stats
        this.usageStats = {
          patterns: [],
          lastAnalyzed: new Date().toISOString()
        };
        await this.saveUsageStats();
      }
    } catch (error) {
      console.error('Failed to load usage stats:', error);
      // Initialize with empty stats as fallback
      this.usageStats = {
        patterns: [],
        lastAnalyzed: new Date().toISOString()
      };
    }
  }
  
  /**
   * Save usage statistics to memory
   */
  private async saveUsageStats(): Promise<void> {
    if (this.usageStats) {
      await this.memoryManager.save(
        this.STATS_KEY,
        JSON.stringify(this.usageStats),
        this.NAMESPACE
      );
    }
  }
  
  /**
   * Record a tool usage event
   * @param toolName The name of the tool used
   * @param success Whether the tool execution was successful
   * @param responseTime The time it took to execute the tool (in ms)
   */
  public async recordToolUsage(toolName: string, success: boolean, responseTime: number): Promise<void> {
    if (!this.usageStats) {
      await this.loadUsageStats();
    }
    
    // Find existing pattern or create a new one
    let pattern = this.usageStats!.patterns.find(p => p.toolName === toolName);
    
    if (!pattern) {
      pattern = {
        toolName,
        frequency: 0,
        successRate: 0,
        averageResponseTime: 0
      };
      this.usageStats!.patterns.push(pattern);
    }
    
    // Update pattern
    pattern.frequency += 1;
    
    // Update success rate as a weighted average
    const oldSuccessWeight = (pattern.frequency - 1) / pattern.frequency;
    const newSuccessWeight = 1 / pattern.frequency;
    pattern.successRate = 
      (pattern.successRate * oldSuccessWeight) + 
      (success ? 1 : 0) * newSuccessWeight;
    
    // Update average response time as a weighted average
    pattern.averageResponseTime = 
      (pattern.averageResponseTime * oldSuccessWeight) + 
      (responseTime * newSuccessWeight);
    
    // Save updated stats
    this.usageStats!.lastAnalyzed = new Date().toISOString();
    await this.saveUsageStats();
  }
  
  /**
   * Analyze usage patterns and generate improvement suggestions
   * @returns Array of improvement suggestions
   */
  public async analyzePatterns(): Promise<ImprovementSuggestion[]> {
    if (!this.usageStats) {
      await this.loadUsageStats();
    }
    
    if (!this.usageStats || this.usageStats.patterns.length === 0) {
      return [];
    }
    
    const suggestions: ImprovementSuggestion[] = [];
    
    // Analyze each tool's usage
    for (const pattern of this.usageStats.patterns) {
      // Low success rate suggests implementation issues
      if (pattern.successRate < 0.8 && pattern.frequency > 5) {
        suggestions.push({
          toolName: pattern.toolName,
          suggestion: `Improve reliability of ${pattern.toolName}`,
          priority: 'high',
          reason: `Success rate of ${Math.round(pattern.successRate * 100)}% is below threshold`
        });
      }
      
      // High response time suggests performance issues
      if (pattern.averageResponseTime > 2000 && pattern.frequency > 5) {
        suggestions.push({
          toolName: pattern.toolName,
          suggestion: `Optimize performance of ${pattern.toolName}`,
          priority: 'medium',
          reason: `Average response time of ${Math.round(pattern.averageResponseTime)}ms is above threshold`
        });
      }
      
      // Low frequency suggests low utility or discoverability
      if (pattern.frequency < 3 && this.usageStats.patterns.length > 5) {
        suggestions.push({
          toolName: pattern.toolName,
          suggestion: `Improve discoverability or utility of ${pattern.toolName}`,
          priority: 'low',
          reason: `Low usage frequency (${pattern.frequency}) compared to other tools`
        });
      }
    }
    
    // Save suggestions to memory
    await this.memoryManager.save(
      this.SUGGESTIONS_KEY,
      JSON.stringify(suggestions),
      this.NAMESPACE
    );
    
    // Return the suggestions
    return suggestions;
  }
  
  /**
   * Get the most recent improvement suggestions
   * @returns Array of improvement suggestions
   */
  public async getSuggestions(): Promise<ImprovementSuggestion[]> {
    try {
      const suggestions = await this.memoryManager.get(this.SUGGESTIONS_KEY, this.NAMESPACE);
      if (suggestions) {
        return JSON.parse(suggestions);
      }
      
      // If no suggestions exist, generate them
      return this.analyzePatterns();
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }
  
  /**
   * Generate a markdown report of tool usage and suggestions
   * @param outputPath Optional path to save the report to
   * @returns The report content
   */
  public async generateReport(outputPath?: string): Promise<string> {
    if (!this.usageStats) {
      await this.loadUsageStats();
    }
    
    const suggestions = await this.getSuggestions();
    
    // Generate report content
    let report = '# Self-Improvement Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    // Tool usage section
    report += '## Tool Usage Statistics\n\n';
    report += '| Tool | Frequency | Success Rate | Avg Response Time |\n';
    report += '|------|-----------|-------------|-------------------|\n';
    
    if (this.usageStats && this.usageStats.patterns.length > 0) {
      for (const pattern of this.usageStats.patterns) {
        report += `| ${pattern.toolName} | ${pattern.frequency} | ${Math.round(pattern.successRate * 100)}% | ${Math.round(pattern.averageResponseTime)}ms |\n`;
      }
    } else {
      report += '| *No data available* | - | - | - |\n';
    }
    
    // Suggestions section
    report += '\n## Improvement Suggestions\n\n';
    
    if (suggestions.length > 0) {
      for (const suggestion of suggestions) {
        report += `### ${suggestion.suggestion} (${suggestion.priority} priority)\n\n`;
        report += `**Tool**: ${suggestion.toolName}\n\n`;
        report += `**Reason**: ${suggestion.reason}\n\n`;
      }
    } else {
      report += '*No improvement suggestions at this time.*\n\n';
    }
    
    // Save report to file if path provided
    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, report, 'utf-8');
    }
    
    return report;
  }
  
  /**
   * Update the .cursorrules file with suggestions
   */
  public async updateCursorRules(): Promise<void> {
    const suggestions = await this.getSuggestions();
    
    if (suggestions.length === 0) {
      return;
    }
    
    // Get the top 3 highest priority suggestions
    const topSuggestions = suggestions
      .sort((a, b) => {
        const priorityValue = { 'high': 3, 'medium': 2, 'low': 1 };
        return priorityValue[b.priority] - priorityValue[a.priority];
      })
      .slice(0, 3);
    
    // Format suggestions for the .cursorrules file
    const suggestionText = topSuggestions
      .map(s => `- ${s.suggestion}: ${s.reason}`)
      .join('\n');
    
    // Try to update the .cursorrules file
    try {
      const rulesPath = './.cursorrules';
      
      if (fs.existsSync(rulesPath)) {
        let content = fs.readFileSync(rulesPath, 'utf-8');
        
        // Check if the Lessons section exists
        if (content.includes('# Lessons')) {
          // Add a new section for self-improvement if it doesn't exist
          if (!content.includes('## Self-Improvement Suggestions')) {
            content = content.replace(
              '# Lessons',
              '# Lessons\n\n## Self-Improvement Suggestions\n\n' + suggestionText + '\n'
            );
          } else {
            // Update existing section
            const regex = /(## Self-Improvement Suggestions\n\n)([\s\S]*?)(\n\n##|$)/;
            const match = content.match(regex);
            
            if (match) {
              content = content.replace(
                regex,
                `$1${suggestionText}$3`
              );
            }
          }
          
          fs.writeFileSync(rulesPath, content, 'utf-8');
        }
      }
    } catch (error) {
      console.error('Failed to update .cursorrules file:', error);
    }
  }
} 