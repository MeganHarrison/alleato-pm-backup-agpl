/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { Button } from "@/components/ui/button";

jest.mock("nanoid", () => ({
  nanoid: jest.fn(() => "attachment-id"),
}));

import {
  PromptInput,
  PromptInputTextarea,
  type PromptInputMessage,
} from "../prompt-input";

describe("PromptInput attachments", () => {
  const createObjectURL = jest.fn(() => "blob:attachment-url");
  const revokeObjectURL = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  it("submits multiple selected files as AI SDK file parts", async () => {
    const onSubmit = jest.fn<void, [PromptInputMessage]>();

    render(
      <PromptInput multiple onSubmit={(message) => onSubmit(message)}>
        <PromptInputTextarea />
        <Button type="submit">Send</Button>
      </PromptInput>,
    );

    const fileInput = screen.getByLabelText("Upload files") as HTMLInputElement;
    const spec = new File(["Spec notes"], "spec.md", { type: "text/markdown" });
    const photo = new File(["image bytes"], "site.jpg", { type: "image/jpeg" });

    fireEvent.change(fileInput, { target: { files: [spec, photo] } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].files).toEqual([
      expect.objectContaining({
        filename: "spec.md",
        mediaType: "text/markdown",
        type: "file",
      }),
      expect.objectContaining({
        filename: "site.jpg",
        mediaType: "image/jpeg",
        type: "file",
      }),
    ]);
  });

  it("supports per-file size limits before attachments are read", async () => {
    const onSubmit = jest.fn<void, [PromptInputMessage]>();
    const onError = jest.fn();

    render(
      <PromptInput
        multiple
        maxFileSize={(file) => (file.type === "image/png" ? 3 : 10)}
        onError={onError}
        onSubmit={(message) => onSubmit(message)}
      >
        <PromptInputTextarea />
        <Button type="submit">Send</Button>
      </PromptInput>,
    );

    const fileInput = screen.getByLabelText("Upload files") as HTMLInputElement;
    const oversizedImage = new File(["four"], "plan.png", {
      type: "image/png",
    });
    const locallyReadableWorkbook = new File(["four"], "estimate.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fireEvent.change(fileInput, {
      target: { files: [oversizedImage, locallyReadableWorkbook] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "max_file_size" }),
    );
    expect(onSubmit.mock.calls[0][0].files).toEqual([
      expect.objectContaining({ filename: "estimate.xlsx" }),
    ]);
  });

  it("caps aggregate selected bytes before blob conversion", async () => {
    const onSubmit = jest.fn<void, [PromptInputMessage]>();
    const onError = jest.fn();

    render(
      <PromptInput
        multiple
        maxFileSize={10}
        maxTotalFileSize={5}
        onError={onError}
        onSubmit={(message) => onSubmit(message)}
      >
        <PromptInputTextarea />
        <Button type="submit">Send</Button>
      </PromptInput>,
    );

    const fileInput = screen.getByLabelText("Upload files") as HTMLInputElement;
    const first = new File(["four"], "first.txt", { type: "text/plain" });
    const second = new File(["four"], "second.txt", { type: "text/plain" });

    fireEvent.change(fileInput, { target: { files: [first, second] } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "max_total_file_size" }),
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].files).toEqual([
      expect.objectContaining({ filename: "first.txt" }),
    ]);
  });
});