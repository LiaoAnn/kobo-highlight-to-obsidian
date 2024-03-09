export type Node = {
  type: 'book' | 'chapter' | 'highlight';
  text: string;
  children: Node[];
};

export class Book {
  chapter: Node | undefined;
  bookName: string = '';
  private lines: string[] = [];
  private currLineIndex: number = 0;

  constructor(lines: string[]) {
    this.lines = lines;

    const firstLine = this.lines[this.currLineIndex];
    this.bookName = firstLine;
    this.chapter = this.initChapter();
  }

  initChapter = (layer = 0): Node => {
    let result: Node | undefined;
    let cache = '';
    while (this.currLineIndex < this.lines.length) {
      const line = this.lines[this.currLineIndex];

      if (line.trim() === '') {
        cache &&
          result?.children.push({
            type: 'highlight',
            text: cache,
            children: [],
          });
        cache = '';
        this.currLineIndex++;
        continue;
      }

      const lineLayer = line.match(/#/g)?.length || 0;
      const chapterRegex = /^[#]+\s/g;
      const isTitle = chapterRegex.test(line);

      if (this.currLineIndex === 0 || isTitle) {
        // init chapter
        if (!result) {
          result = {
            type: this.currLineIndex === 0 ? 'book' : 'chapter',
            text: line.replace(/#/g, '').trim(),
            children: [],
          };
          this.currLineIndex++;
          continue;
        }

        // father chapter or brother chapter
        if (lineLayer <= layer) break;

        // push sub chapter
        const subChapter = this.initChapter(lineLayer);
        result.children.push(subChapter);
        continue;
      }

      if (cache != '') cache += '\n';
      cache += line;
      this.currLineIndex++;
    }
    return result!;
  };

  printJson = () => {
    console.log(JSON.stringify(this.chapter, null, 2));
  };

  getChapters = () => {
    return this.chapter?.children || [];
  };

  getChaptersOnly = (maxLayer = -1): Node[] => {
    return this.selfGetChaptersOnly(maxLayer);
  };

  private selfGetChaptersOnly = (
    maxLayer: number,
    currLayer = 0,
    currChapter?: Node,
  ): Node[] => {
    return ((currChapter || this.chapter)?.children || [])
      .filter((chapter) => chapter.type === 'chapter')
      .map(
        (chapter) =>
          ({
            ...chapter,
            children:
              maxLayer === -1 || currLayer < maxLayer
                ? this.selfGetChaptersOnly(maxLayer, currLayer + 1, chapter)
                : [],
          }) as Node,
      );
  };
}
