/**
 * DeukPack Performance Monitor
 * Performance tracking and metrics
 */

export interface PerformanceMetrics {
  parseTime: number;
  generateTime: number;
  serializeTime: number;
  deserializeTime: number;
  memoryUsage: number;
  fileCount: number;
  lineCount: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    parseTime: 0,
    generateTime: 0,
    serializeTime: 0,
    deserializeTime: 0,
    memoryUsage: 0,
    fileCount: 0,
    lineCount: 0
  };

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      parseTime: 0,
      generateTime: 0,
      serializeTime: 0,
      deserializeTime: 0,
      memoryUsage: 0,
      fileCount: 0,
      lineCount: 0
    };
  }

  updateParseTime(time: number): void {
    this.metrics.parseTime = time;
  }

  updateGenerateTime(time: number): void {
    this.metrics.generateTime = time;
  }

  updateSerializeTime(time: number): void {
    this.metrics.serializeTime = time;
  }

  updateDeserializeTime(time: number): void {
    this.metrics.deserializeTime = time;
  }

  updateMemoryUsage(usage: number): void {
    this.metrics.memoryUsage = usage;
  }

  updateFileCount(count: number): void {
    this.metrics.fileCount = count;
  }

  updateLineCount(count: number): void {
    this.metrics.lineCount = count;
  }
}
