export type Format = {
  chapterName?: string;
  highlightText?: string;
  highlightNumber?: number;
};

export type Property = {
  [key: string]: string[] | string;
};

export type Config = {
  bookPath: string;
  chapterPath: string;
  highlightsPath: string;
  generatedMindMap: boolean;
  mindMapPath?: string;
  usingHeadings: boolean;
  properties: {
    book?: Property;
    chapter?: Property;
    highlight?: Property;
    mindMap?: Property;
  };
};
