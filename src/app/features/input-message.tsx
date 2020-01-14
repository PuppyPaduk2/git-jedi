import * as React from "react";
import { useStore } from "effector-react";
import * as ui from "../ui";
import { $showedBranches, showBranches, $currentBranch } from "../model";

export const InputMessage: React.FC = () => {
  const showedBranches = useStore($showedBranches);
  const currentBranch = useStore($currentBranch);

  return (
    <ui.PanelBottom>
      <ui.ButtonLink onClick={() => showBranches(!showedBranches)}>
        {currentBranch}
      </ui.ButtonLink>

      <ui.Input />

      <ui.Button onClick={() => {}}>Send</ui.Button>
    </ui.PanelBottom>
  );
};
