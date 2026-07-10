export interface PlatformAdapter {
  isExtension: boolean;
  getFaviconUrl(url: string, domain: string): string;
  getCurrentTabUrl(): Promise<string | null>;
}
