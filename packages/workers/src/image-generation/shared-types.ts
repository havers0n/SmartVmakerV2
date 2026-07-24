export interface Logger {
  info?: (msg: any, ...args: any[]) => void;
  warn?: (msg: any, ...args: any[]) => void;
  error?: (msg: any, ...args: any[]) => void;
  fatal?: (msg: any, ...args: any[]) => void;
  debug?: (msg: any, ...args: any[]) => void;
}
