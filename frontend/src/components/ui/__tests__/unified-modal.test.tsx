/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalTitle,
} from "../unified-modal";

describe("ModalContent", () => {
  it("owns a mobile viewport inset before applying its configured desktop size", () => {
    render(
      <Modal open>
        <ModalContent size="xl">
          <ModalTitle>Site-wide search</ModalTitle>
          <ModalDescription>
            Find a project record or destination.
          </ModalDescription>
        </ModalContent>
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toHaveClass(
      "w-full",
      "max-w-[calc(100%-2rem)]",
      "sm:max-w-xl",
    );
  });
});
