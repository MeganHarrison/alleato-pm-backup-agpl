import { defineSandbox } from "eve/sandbox";

export default defineSandbox({
  async bootstrap({ use }) {
    const sandbox = await use();

    // Eve's GitHub channel checks out the repo into /workspace. Mark it safe up
    // front on the template so hosted git checkout can run before the first
    // turn preamble tries to configure the repository.
    await sandbox.run({
      command:
        "git config --global --add safe.directory /workspace >/dev/null 2>&1 || true",
    });
  },
});
