import * as fs from 'fs-extra';
import { Config, Format, Highlight, Property } from './types';
import path from 'path';

export class Convert {
  static basePath = 'vault/';
  config: Config;
  bookName: string = '';
  lines: string[] = [];
  currLineIndex = 0;

  constructor(config: Config) {
    this.config = config;
  }

  getValueAfterFormat = (value: string, format: Format) => {
    const {
      chapterName: chapter_name,
      highlightText: highlight_text,
      highlightNumber: highlight_number,
    } = format;

    value = value.replace(/{book_name}/g, this.bookName);

    const todayDateRegex = /{today_date}/g;
    if (todayDateRegex.test(value)) {
      const date = new Date();
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const today = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      value = value.replace(/{today_date}/g, today);
    }

    const regexChapterName = /{chapter_name}/g;
    if (regexChapterName.test(value)) {
      if (!chapter_name) throw new Error('chapter_name is required');
      value = value.replace(/{chapter_name}/g, chapter_name);
    }

    const regexHighlightText = /{highlight_text}/g;
    if (regexHighlightText.test(value)) {
      if (!highlight_text) throw new Error('highlight_text is required');
      value = value.replace(/{highlight_text}/g, highlight_text);
    }

    const regexHighlightTextSL = /{highlight_text_sl}/g;
    if (regexHighlightTextSL.test(value)) {
      if (!highlight_text) throw new Error('highlight_text is required');
      value = value.replace(
        /{highlight_text_sl}/g,
        highlight_text.replace(/\n/g, ' '),
      );
    }

    const regexHighlightNumber = /{highlight_number}/g;
    if (regexHighlightNumber.test(value)) {
      if (!highlight_number) throw new Error('highlight_number is required');
      value = value.replace(/{highlight_number}/g, highlight_number.toString());
    }

    return value;
  };

  getHighlights = (layer = 0) => {
    const highLightResult: Highlight = {};
    const result: string[] = [];

    // read file if lines are empty
    if (this.lines.length === 0) {
      const { fileName } = this.config;
      const highlights = fs.readFileSync(fileName, 'utf8');
      this.lines = highlights.split('\n');
    }

    // start process the file
    let cache = '';
    while (this.currLineIndex < this.lines.length) {
      const line = this.lines[this.currLineIndex];

      // book name
      if (this.currLineIndex === 0) {
        this.bookName = line;
        this.currLineIndex++;
        continue;
      }

      // empty line
      if (line.trim() === '') {
        cache && result.push(cache);
        cache = '';
        this.currLineIndex++;
        continue;
      }

      const lineLayer = line.match(/#/g)?.length || 0;
      // highlight
      if (lineLayer === 0) {
        if (cache != '') cache += '\n';
        cache += line;
        this.currLineIndex++;
        continue;
      }

      // new chapter
      if (lineLayer <= layer) break;
      this.currLineIndex++;
      const title = line.replace(/#/g, '').trim();
      const highlights = this.getHighlights(lineLayer);
      highLightResult[title] = highlights;
    }

    return result.length ? result : highLightResult;
  };

  getTagContent = (property: Property | undefined, format: Format) => {
    let tagContent = `---\n`;
    if (property) {
      for (const key in property) {
        const value = property[key];
        if (Array.isArray(value)) {
          tagContent += `${key}:\n`;
          for (const item of value) {
            tagContent += `  - ${this.getValueAfterFormat(item, format)}\n`;
          }
        } else {
          tagContent += `${key}: ${this.getValueAfterFormat(value, format)}\n`;
        }
      }
    }
    tagContent += `---\n`;
    return tagContent;
  };

  generateFiles = (highlight: Highlight) => {
    // book
    const bookPath = this.getValueAfterFormat(this.config.bookPath, {});
    const fullBooKPath = path.join(Convert.basePath, bookPath);
    if (!fs.existsSync(path.dirname(fullBooKPath))) {
      fs.mkdirSync(path.dirname(fullBooKPath), { recursive: true });
    }
    const bookTagContent = this.getTagContent(this.config.properties.book, {});
    const bookContent = `${bookTagContent}
# Chapters

${Object.keys(highlight)
  .map((chapterName) => `- [[${chapterName}]]`)
  .join('\n')}
`;
    fs.writeFileSync(`${fullBooKPath}.md`, bookContent);

    // chapters
    const generateChapter = (
      chapterName: string,
      chapterHighlight: Highlight | string[],
    ) => {
      const chapterPath = this.getValueAfterFormat(this.config.chapterPath, {
        chapterName,
      });
      const fullChapterPath = path.join(Convert.basePath, chapterPath);
      if (!fs.existsSync(path.dirname(fullChapterPath))) {
        fs.mkdirSync(path.dirname(fullChapterPath), { recursive: true });
      }
      const chapterTagContent = this.getTagContent(
        this.config.properties.chapter,
        { chapterName },
      );
      let chapterContent = '';
      const highlights = [] as string[];
      if (Array.isArray(chapterHighlight)) {
        // chapter
        chapterContent = `${chapterTagContent}
# Highlights

${chapterHighlight
  .map(
    (highlightName, index) =>
      `- [[${this.getValueAfterFormat(this.config.highlightsPath, {
        chapterName,
        highlightText: highlightName,
        highlightNumber: index + 1,
      })}|${highlightName.replace(/\n/g, ' ')}]]`,
  )
  .join('\n')}
`;

        // highlights
        highlights.push(...chapterHighlight);
      } else {
        // chapter
        let index = 0;
        const getChapterList = (chapter: Highlight | string[], layer = 1) => {
          const result: string[] = [];
          if (Array.isArray(chapter)) {
            highlights.push(...chapter);
            return chapter.map(
              (highlightName) =>
                `- [[${this.getValueAfterFormat(this.config.highlightsPath, {
                  chapterName,
                  highlightText: highlightName,
                  highlightNumber: ++index,
                })}|${highlightName.replace(/\n/g, ' ')}]]`,
            );
          }
          for (const key in chapter) {
            const value = chapter[key];
            const chapterList = getChapterList(value, layer + 1).join('\n');
            result.push(`#`.repeat(layer) + ` ${key}\n\n${chapterList}\n`);
          }
          return result;
        };
        chapterContent = `${chapterTagContent}
${getChapterList(chapterHighlight).join('\n')}
`;
      }

      // highlights
      let index = 0;
      for (const highlightName of highlights) {
        const highlightPath = this.getValueAfterFormat(
          this.config.highlightsPath,
          {
            chapterName,
            highlightText: highlightName,
            highlightNumber: ++index,
          },
        );
        const fullHighlightPath = path.join(Convert.basePath, highlightPath);
        if (!fs.existsSync(path.dirname(fullHighlightPath))) {
          fs.mkdirSync(path.dirname(fullHighlightPath), { recursive: true });
        }
        const highlightTagContent = this.getTagContent(
          this.config.properties.highlight,
          { chapterName, highlightText: highlightName, highlightNumber: index },
        );
        const highlightContent = `${highlightTagContent}
${highlightName}
`;
        fs.writeFileSync(`${fullHighlightPath}.md`, highlightContent);
      }

      fs.writeFileSync(`${fullChapterPath}.md`, chapterContent);
    };
    Object.keys(highlight).forEach((chapterName) => {
      generateChapter(chapterName, highlight[chapterName]);
    });
  };

  generateMindMap = (highlight: Highlight) => {
    if (!this.config.mindMapPath) {
      throw new Error('mindMapFolder is required');
    }

    const mindMapPath = this.getValueAfterFormat(this.config.mindMapPath, {});
    const fullMindMapPath = path.join(Convert.basePath, mindMapPath);
    if (!fs.existsSync(path.dirname(fullMindMapPath))) {
      fs.mkdirSync(path.dirname(fullMindMapPath), { recursive: true });
    }
    const mindMapTagContent = this.getTagContent(
      this.config.properties.mindMap,
      {},
    );

    const getChapterTree = (
      chapter: Highlight | string[],
      layer = 1,
      chapterName?: string,
    ) => {
      let result = '';
      if (Array.isArray(chapter)) {
        return chapter
          .map(
            (highlightName, index) =>
              `${'  '.repeat(layer - 1)}- [[${this.getValueAfterFormat(
                this.config.highlightsPath,
                {
                  chapterName,
                  highlightText: highlightName,
                  highlightNumber: ++index,
                },
              )}|${highlightName.replace(/\n/g, ' ')}]]\n`,
          )
          .join('');
      }
      for (const key in chapter) {
        const value = chapter[key];
        result += `${'  '.repeat(layer - 1)}- ${key}\n`;
        result += getChapterTree(value, layer + 1, chapterName || key);
      }
      return result;
    };

    const mindMapContent = `${mindMapTagContent}
${getChapterTree(highlight)}
`;
    fs.writeFileSync(`${fullMindMapPath}.md`, mindMapContent);
  };

  startProcess = () => {
    const highlight = this.getHighlights() as Highlight;
    this.generateFiles(highlight);
    if (!this.config.generatedMindMap) return;

    this.generateMindMap(highlight);
  };
}
