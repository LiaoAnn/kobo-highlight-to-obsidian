import * as fs from 'fs-extra';
import { Config, Format, Property } from './types';
import path from 'path';
import { Book, Node } from './book';

export class Convert {
  static basePath = 'vault/';
  private highlightIndexMap = new Map<string, number>();
  config: Config;
  book: Book | null = null;

  constructor(config: Config) {
    this.config = config;

    const fileName = `input.txt`;
    if (!fs.existsSync(fileName)) throw new Error(`${fileName} not found`);
    const inputFile = fs.readFileSync(fileName, 'utf-8');
    const lines = inputFile.split('\n');
    this.book = new Book(lines);
  }

  getValueAfterFormat = (value: string, format: Format) => {
    const {
      chapterName: chapter_name,
      highlightText: highlight_text,
      highlightNumber: highlight_number,
    } = format;

    if (!this.book) throw new Error('book is required');

    value = value.replace(/{book_name}/g, this.book.bookName);

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
    tagContent += `---`;
    return tagContent;
  };

  private generateBook = () => {
    // book
    const bookPath = this.getValueAfterFormat(this.config.bookPath, {});
    const fullBooKPath = path.join(Convert.basePath, bookPath);
    if (!fs.existsSync(path.dirname(fullBooKPath))) {
      fs.mkdirSync(path.dirname(fullBooKPath), { recursive: true });
    }
    const bookTagContent = this.getTagContent(this.config.properties.book, {});
    const bookContent = `${bookTagContent}
# Chapters

${this.book
  ?.getChaptersOnly(1)
  .map((chapter) => `- [[${chapter.text}]]`)
  .join('\n')}
`;
    fs.writeFileSync(`${fullBooKPath}.md`, bookContent);
  };

  private generateChaptersAndHighlights = () => {
    // create chapter folder
    const chapterFolder = path.dirname(
      this.getValueAfterFormat(this.config.chapterPath, {
        chapterName: 'file',
      }),
    );
    const fullChapterFolder = path.join(Convert.basePath, chapterFolder);
    if (!fs.existsSync(fullChapterFolder)) {
      fs.mkdirSync(fullChapterFolder, { recursive: true });
    }

    // create chapter files
    const chapters = this.book?.getChapters();
    if (!chapters) return;

    const highlightIndexMap = new Map<string, number>();
    const getChapterBody = (chapter: Node, chapterName?: string, layer = 1) => {
      let result = '';
      if (chapter.type === 'highlight') {
        // update highlight index
        const highlightIndex = highlightIndexMap.get(chapterName!) || 1;
        highlightIndexMap.set(chapterName!, highlightIndex + 1);

        return `${'  '.repeat(layer - 2)}- [[${this.getValueAfterFormat(
          this.config.highlightsPath,
          {
            chapterName,
            highlightText: chapter.text,
            highlightNumber: highlightIndex,
          },
        )}|${chapter.text.replace(/\n/g, ' ')}]]\n`;
      }

      if (layer > 1) {
        // print sub chapter
        result += this.config.usingHeadings
          ? `\n${'#'.repeat(layer - 1)} ${chapter.text}\n\n`
          : `${'  '.repeat(layer - 1)}- ${chapter.text}\n`;
      } else {
        // init highlight index for each chapter
        highlightIndexMap.set(chapter.text, 1);
      }

      for (const child of chapter.children) {
        result += getChapterBody(child, chapterName || chapter.text, layer + 1);
      }
      return result;
    };

    for (const chapter of chapters) {
      const chapterPath = this.getValueAfterFormat(this.config.chapterPath, {
        chapterName: chapter.text,
      });
      const fullChapterPath = path.join(Convert.basePath, chapterPath);
      const chapterTagContent = this.getTagContent(
        this.config.properties.chapter,
        { chapterName: chapter.text },
      );
      const chapterContent = `${chapterTagContent}
${getChapterBody(chapter, chapter.text)}`;
      fs.writeFileSync(`${fullChapterPath}.md`, chapterContent);

      this.generateHighlights(chapter.text, chapter);
    }
  };

  private generateHighlights = (mainChapterName: string, chapterNode: Node) => {
    if (!this.highlightIndexMap.has(mainChapterName)) {
      this.highlightIndexMap.set(mainChapterName, 1);
    }

    const highlightsFolder = path.dirname(
      this.getValueAfterFormat(this.config.highlightsPath, {
        chapterName: mainChapterName,
        highlightNumber: this.highlightIndexMap.get(mainChapterName) || 1,
      }),
    );
    const fullHighlightsFolder = path.join(Convert.basePath, highlightsFolder);
    if (!fs.existsSync(fullHighlightsFolder)) {
      fs.mkdirSync(fullHighlightsFolder, { recursive: true });
    }

    for (const child of chapterNode.children) {
      if (child.type === 'highlight') {
        const index = this.highlightIndexMap.get(mainChapterName) || 1;
        this.highlightIndexMap.set(mainChapterName, index + 1);

        const highlightPath = this.getValueAfterFormat(
          this.config.highlightsPath,
          {
            chapterName: mainChapterName,
            highlightText: child.text,
            highlightNumber: index,
          },
        );
        const fullHighlightPath = path.join(Convert.basePath, highlightPath);

        const highlightTagContent = this.getTagContent(
          this.config.properties.highlight,
          {
            chapterName: mainChapterName,
            highlightText: child.text,
            highlightNumber: index,
          },
        );

        const highlightContent = `${highlightTagContent}
${child.text}`;
        fs.writeFileSync(`${fullHighlightPath}.md`, highlightContent);
      } else {
        this.generateHighlights(mainChapterName, child);
      }
    }
  };

  private generateMindMap = () => {
    if (!this.config.mindMapPath) {
      throw new Error('mindMapPath is required');
    }

    const mindMapPath = this.getValueAfterFormat(this.config.mindMapPath, {});
    const fullMindMapPath = path.join(Convert.basePath, mindMapPath);
    if (!fs.existsSync(path.dirname(fullMindMapPath))) {
      fs.mkdirSync(path.dirname(fullMindMapPath), { recursive: true });
    }

    const highlightIndexMap = new Map<string, number>();
    const getMindMapBody = (
      chapters: Node[],
      chapterName?: string,
      layer = 1,
    ) => {
      let result = '';
      for (const chapter of chapters) {
        if (!highlightIndexMap.has(chapterName || chapter.text)) {
          highlightIndexMap.set(chapterName || chapter.text, 1);
        }

        if (chapter.type === 'highlight') {
          const highlightIndex =
            highlightIndexMap.get(chapterName || chapter.text) || 1;
          highlightIndexMap.set(
            chapterName || chapter.text,
            highlightIndex + 1,
          );
          const linkContent = `[[${this.getValueAfterFormat(
            this.config.highlightsPath,
            {
              chapterName: chapterName || chapter.text,
              highlightText: chapter.text,
              highlightNumber: highlightIndex,
            },
          )}|${chapter.text.replace(/\n/g, ' ')}]]`;
          result += this.config.usingHeadings
            ? `- ${linkContent}\n`
            : `${'  '.repeat(layer - 1)}- ${linkContent}\n`;
        } else {
          result += this.config.usingHeadings
            ? `\n${'#'.repeat(layer)} ${chapter.text}\n\n`
            : `${'  '.repeat(layer - 1)}- ${chapter.text}\n`;
        }
        for (const child of chapter.children) {
          result += getMindMapBody(
            [child],
            chapterName || chapter.text,
            layer + 1,
          );
        }
      }
      return result;
    };

    const mindMapContent = `${this.getTagContent(this.config.properties.mindMap, {})}
${getMindMapBody(this.book!.getChapters())}`;
    fs.writeFileSync(
      `${path.join(Convert.basePath, mindMapPath)}.md`,
      mindMapContent,
    );
  };

  generate = () => {
    this.generateBook();
    this.generateChaptersAndHighlights();
    if (this.config.generatedMindMap) {
      this.generateMindMap();
    }
  };

  startProcess = () => {
    console.log('Generating...');
    this.generate();
    console.log('Done');
  };
}
