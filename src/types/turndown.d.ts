declare module 'turndown' {
  interface Options {
    headingStyle?: 'setext' | 'atx';
    hr?: string;
    bulletListMarker?: '-' | '+' | '*';
    codeBlockStyle?: 'indented' | 'fenced';
    emDelimiter?: '_' | '*';
    strongDelimiter?: '__' | '**';
    linkStyle?: 'inlined' | 'referenced';
    linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut';
  }

  class TurndownService {
    constructor(options?: Options);
    turndown(html: string | HTMLElement): string;
    use(plugin: unknown): this;
    remove(filter: string | string[]): this;
    addRule(key: string, rule: unknown): this;
  }

  export default TurndownService;
}

declare module 'turndown-plugin-gfm' {
  export const gfm: unknown;
  export const tables: unknown;
  export const strikethrough: unknown;
}
