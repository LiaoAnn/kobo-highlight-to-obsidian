export type Format = {
  chapterName?: string;
  highlightText?: string;
  highlightNumber?: number;
};

export type Highlight = {
  [key: string]: Highlight | string[];
};

export type Property = {
  [key: string]: string[] | string;
};

export type Config = {
  fileName: string;
  bookPath: string;
  chapterPath: string;
  highlightsPath: string;
  generatedMindMap: boolean;
  mindMapPath?: string;
  properties: {
    book?: Property;
    chapter?: Property;
    highlight?: Property;
    mindMap?: Property;
  };
};
