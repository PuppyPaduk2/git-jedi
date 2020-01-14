import { createStore, createEvent, forward } from "effector";
import { core, layout } from "../lib/git-api";
import { setPreCommand } from "../lib/git-api/core/exec";

const PATH = "PATH";

const defaultPath = localStorage.getItem(PATH) || "./";

setPreCommand(`cd ${defaultPath}`);

export const $path = createStore<string>(defaultPath);
export const $branches = createStore<core.showRef.Refs>(
  layout.showRef.getBranches()
);
export const $log = createStore<core.types.Log>(core.log.get());
export const $showedBranches = createStore<boolean>(false);
export const $currentBranch = createStore<string>(
  core.revParse.getCurrentBranch()
);
export const $refs = createStore<core.showRef.GetResult>(core.showRef.get());
export const $isChanged = createStore<boolean>(core.status.isChanged());
export const $statusPaths = createStore<core.status.StatusPath[]>(
  core.status.get()
);
export const $isShowStatusPaths = createStore<boolean>(false);

export const changePath = createEvent<string>();
export const showBranches = createEvent<boolean>();
export const checkoutToBranch = createEvent<string>();
export const showStatusPaths = createEvent<boolean>();

forward({
  from: showBranches,
  to: $showedBranches
});

forward({
  from: showStatusPaths,
  to: $isShowStatusPaths
});

$path.on(changePath, (_, path) => {
  setPreCommand(`cd ${path}`);
  localStorage.setItem(PATH, path);

  return path;
});

$branches.on($path, () => layout.showRef.getBranches());

$log.on($path, () => core.log.get()).on($currentBranch, () => core.log.get());

$currentBranch
  .on($path, () => core.revParse.getCurrentBranch())
  .on(checkoutToBranch, (_, nameBranch) => {
    if (core.status.isChanged() === false) {
      core.checkout.run(nameBranch);
    }

    return nameBranch;
  });

$refs.on($path, () => core.showRef.get());

$isChanged
  .on($path, () => core.status.isChanged())
  .on($currentBranch, () => core.status.isChanged());

$statusPaths
  .on($path, () => core.status.get())
  .on($currentBranch, () => core.status.get());
