import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { SimplePagination } from "./pagination";

const meta: Meta = {
  title: "Navigation/Pagination",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

function DefaultDemo() {
  const [page, setPage] = React.useState(1);
  return <SimplePagination currentPage={page} totalPages={10} onPageChange={setPage} />;
}

function FewPagesDemo() {
  const [page, setPage] = React.useState(2);
  return <SimplePagination currentPage={page} totalPages={4} onPageChange={setPage} />;
}

function ManyPagesDemo() {
  const [page, setPage] = React.useState(5);
  return <SimplePagination currentPage={page} totalPages={25} onPageChange={setPage} />;
}

export const Default = { render: () => <DefaultDemo /> };
export const FewPages = { render: () => <FewPagesDemo /> };
export const ManyPages = { render: () => <ManyPagesDemo /> };
