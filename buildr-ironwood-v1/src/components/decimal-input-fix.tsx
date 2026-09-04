"use client";

import { useEffect } from "react";

function relaxDecimalSteps(root: ParentNode) {
  root.querySelectorAll<HTMLInputElement>('input[type="number"]').forEach((input) => {
    const step = input.getAttribute("step");
    if (!step || step === "any") return;

    const numericStep = Number(step);
    if (!Number.isFinite(numericStep) || !step.includes(".")) return;

    input.setAttribute("step", "any");
  });
}

export function DecimalInputFix() {
  useEffect(() => {
    relaxDecimalSteps(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches('input[type="number"]')) {
            relaxDecimalSteps(node.parentElement ?? node);
          } else {
            relaxDecimalSteps(node);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
