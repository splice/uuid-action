import { v4 as uuidv4, v5 as uuidv5, validate as uuidValidate } from "uuid";
import * as core from "@actions/core";

async function run() {
  try {
    const name = core.getInput("name");
    const namespaceInput = core.getInput("namespace");
    const namespace = namespaceInput || "f9962f80-1514-11ea-bfe7-1f9e6cf0a044";

    if (namespaceInput && !uuidValidate(namespaceInput)) {
      core.setFailed(
        `Invalid namespace input: "${namespaceInput}". Must be a valid UUID.`,
      );
      return;
    }

    const uuid = name ? uuidv5(name, namespace) : uuidv4();

    core.setOutput("uuid", uuid);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
