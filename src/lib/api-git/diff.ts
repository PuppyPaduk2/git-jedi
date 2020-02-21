import { runCommandGit, RunCommandOptions } from "lib/run-command";

export interface DiffOptions extends RunCommandOptions {
  commits?: string[];
  paths?: string[];
  cached?: boolean;
}

export const diff = (options: DiffOptions = {}) => {
  const args = createArgs(options);

  return runCommandGit("diff", args, options)
    .next(toFilesBlocks)
    .next(toDiffFiles);
};

function createArgs(options: DiffOptions = {}) {
  const { commits = [], paths = [], cached = false } = options;

  return [
    "--word-diff=porcelain",
    cached ? "--cached" : "",
    ...commits,
    "--",
    ...paths,
  ].filter(Boolean);
}

function toFilesBlocks(stdout: string): string[] {
  return stdout.split("diff --git ").filter(Boolean);
}

function toDiffFiles(filesBlocks: string[]): Map<string, FileDiff> {
  return filesBlocks.reduce((memo, fileBlock) => {
    const diffFile = toDiffFile(fileBlock);

    memo.set(diffFile.info.pathA.slice(2), diffFile);

    return memo;
  }, new Map());
}

export interface FileDiff {
  info: FileInfo;
  chunks: FileDiffChunk[];
}

export interface FileInfo {
  pathA: string;
  pathB: string;
  meta: string;
  legend: string[];
}

export interface FileDiffChunk {
  header: FileDiffHeader;
  lines: FileDiffLine[];
  linesV2: FileDiffLineV2[];
}

export interface FileDiffHeader {
  meta: {
    remove: FileDiffHeaderMeta;
    add: FileDiffHeaderMeta;
  };
  title: string;
}

export interface FileDiffHeaderMeta {
  from: number;
  length: number;
}

export interface FileDiffLine {
  chunks: string[];
  removeNumLine: number;
  addNumLine: number;
  remove: boolean;
  add: boolean;
  spase: boolean;
}

export interface FileDiffLineV2 {
  remove: FileDiffLineByMode | null;
  add: FileDiffLineByMode | null;
}

export interface FileDiffLineByMode {
  chunks: string[];
  numLine: number;
  change: boolean;
}

function toDiffFile(fileBlock: string): FileDiff {
  const [info, ...code] = fileBlock.split("\n@@");
  return { info: toFileInfo(info), chunks: code.map(toFileDiffChunk) };
}

function toFileInfo(block: string): FileInfo {
  const [paths, meta, ...legend] = block.split("\n");
  const [pathA, pathB] = paths.split(" ");

  return {
    pathA,
    pathB,
    meta,
    legend,
  };
}

// TODO For line use different algoritms
function toFileDiffChunk(block: string): FileDiffChunk {
  const [header, ...lines] = block.split("\n");
  const diffHeader = toFileDiffHeader(header.trim());

  return {
    header: diffHeader,
    lines: toFileDiffLines(lines, diffHeader),
    linesV2: toFileDiffLinesV2(lines.filter(Boolean), diffHeader),
  };
}

function toFileDiffHeader(value: string): FileDiffHeader {
  const [meta, title] = value.split(" @@ ");
  const [remove, add] = meta.split(" ");

  return {
    meta: {
      remove: toFileDiffHeaderMeta(remove),
      add: toFileDiffHeaderMeta(add),
    },
    title: title || "",
  };
}

function toFileDiffHeaderMeta(value: string): FileDiffHeaderMeta {
  const [from, length] = value.split(",");

  return { from: parseInt(from.slice(1), 10), length: parseInt(length, 10) };
}

function toFileDiffLines(
  lines: string[],
  diffHeader: FileDiffHeader,
): FileDiffLine[] {
  const nextlines: FileDiffLine[] = [];

  let lastSpaceIndex = 0;
  let removeNumLine = diffHeader.meta.remove.from;
  let addNumLine = diffHeader.meta.add.from;
  let lastNextLine;

  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index];
    const action = line[0];

    switch (action) {
      case " ":
        if (!nextlines[nextlines.length - 1]) {
          nextlines.push({
            chunks: [],
            removeNumLine: 0,
            addNumLine: 0,
            remove: false,
            add: false,
            spase: false,
          });
        }

        nextlines[nextlines.length - 1].chunks.push(line);
        nextlines[nextlines.length - 1].spase = true;
        lastSpaceIndex = nextlines.length - 1;
        break;
      case "-":
        nextlines[nextlines.length - 1].chunks.push(line);
        nextlines[nextlines.length - 1].remove = true;
        break;
      case "+":
        lastNextLine = nextlines[nextlines.length - 1];
        const lastChunkLastNextLine =
          lastNextLine.chunks[lastNextLine.chunks.length - 1];

        // If block 'remove' was before current 'add' line
        if (lastChunkLastNextLine && lastChunkLastNextLine[0] === "-") {
          nextlines[lastSpaceIndex].chunks.push(line);
          nextlines[lastSpaceIndex].add = true;
        } else {
          nextlines[nextlines.length - 1].chunks.push(line);
          nextlines[nextlines.length - 1].add = true;
        }
        break;
      case "~":
        lastNextLine = nextlines[nextlines.length - 1];

        if (lastNextLine.remove || lastNextLine.spase) {
          lastNextLine.removeNumLine = removeNumLine;
          removeNumLine += 1;
        }

        if (lastNextLine.add || lastNextLine.spase) {
          lastNextLine.addNumLine = addNumLine;
          addNumLine += 1;
        }

        // If remove/add empty line
        if (!lastNextLine.remove && !lastNextLine.add && !lastNextLine.spase) {
          const prevLastNextLine = nextlines[nextlines.length - 2];

          lastNextLine.addNumLine = addNumLine;

          if (prevLastNextLine.add) {
            lastNextLine.chunks.push("+");
            lastNextLine.add = true;
            addNumLine += 1;
          }

          if (prevLastNextLine.remove) {
            lastNextLine.chunks.push("-");
            lastNextLine.remove = true;
            removeNumLine += 1;
          }
        }

        nextlines.push({
          chunks: [],
          removeNumLine,
          addNumLine,
          remove: false,
          add: false,
          spase: false,
        });
        break;
    }
  }

  return nextlines;
}

function toFileDiffLinesV2(
  lines: string[],
  diffHeader: FileDiffHeader,
): FileDiffLineV2[] {
  const resultLines: FileDiffLineV2[] = [];
  const removeLines = getLines(lines, diffHeader, "-");
  const addLines = getLines(lines, diffHeader, "+");

  for (let index = 0; index < lines.length; index += 1) {
    const remove = removeLines.add(index);
    const add = addLines.add(index);

    if (remove || add) {
      resultLines.push({ remove, add });
    }
  }

  return resultLines;
}

function getLines(
  lines: string[],
  diffHeader: FileDiffHeader,
  mode: "+" | "-",
) {
  const result: FileDiffLineByMode[] = [
    {
      chunks: [],
      numLine: diffHeader.meta[mode === "-" ? "remove" : "add"].from,
      change: false,
    },
  ];
  const reverseMode = mode === "-" ? "+" : "-";

  return {
    result: () => result,
    add: (index: number) => {
      const line = lines[index];
      const action = line[0];

      switch (action) {
        case " ":
          result[result.length - 1].chunks.push(line);
          break;
        case mode:
          result[result.length - 1].chunks.push(line);
          result[result.length - 1].change = true;
          break;
        case "~":
          const prevLine = lines[index - 1] || "!";
          const prevAction = prevLine[0] || "";
          const nextLine = lines[index + 1] || "!";
          const nextAction = nextLine[0] || "";
          const lastLine = result[result.length - 1];

          if (
            (prevAction === mode && nextAction === mode) ||
            (prevAction === mode && nextAction === " ") ||
            (prevAction === mode && nextAction === "~") ||
            (prevAction === mode && nextAction === "!") ||
            (prevAction === " " && nextAction === mode) ||
            (prevAction === " " && nextAction === " ") ||
            (prevAction === " " && nextAction === "~") ||
            (prevAction === " " && nextAction === "!") ||
            (prevAction === "~" && nextAction === mode) ||
            (prevAction === "~" && nextAction === " ") ||
            (prevAction === "~" && nextAction === "!") ||
            (prevAction === reverseMode && nextAction === " ")
          ) {
            result.push({
              chunks: [],
              numLine:
                diffHeader.meta[mode === "+" ? "add" : "remove"].from +
                result.length,
              change: false,
            });

            return lastLine;
          }
          break;
      }

      return null;
    },
  };
}
