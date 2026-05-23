"use client";

import { useEffect, useState } from "react";
import {
  DeductibleStatusLabels,
  DocumentStatusLabels,
  type DeductibleStatus,
  type DocumentStatus,
} from "@/lib/enums";
import {
  NEEDS_REVIEW_EDUCATION_DISMISSED_KEY,
  NEEDS_REVIEW_TOOLTIP,
  isEducationDismissed,
} from "@/lib/userEducation";
import { InfoTooltip } from "./InfoTooltip";
import {
  NeedsReviewEducationModal,
  claimNeedsReviewModal,
  releaseNeedsReviewModalClaim,
} from "./NeedsReviewEducationModal";

export function DocumentStatusBadge({ status }: { status: DocumentStatus | string }) {
  const isNeedsReview = status === "needs_review";
  const [educationDismissed, setEducationDismissed] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const dismissed = isEducationDismissed(NEEDS_REVIEW_EDUCATION_DISMISSED_KEY);
    setEducationDismissed(dismissed);
    if (isNeedsReview && !dismissed && claimNeedsReviewModal()) {
      setShowModal(true);
    }

    function onEducationDismissed(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === NEEDS_REVIEW_EDUCATION_DISMISSED_KEY) {
        setEducationDismissed(true);
        setShowModal(false);
      }
    }

    window.addEventListener("rblv-education-dismissed", onEducationDismissed);
    return () => window.removeEventListener("rblv-education-dismissed", onEducationDismissed);
  }, [isNeedsReview]);

  function handleModalDismiss() {
    setEducationDismissed(true);
    setShowModal(false);
    releaseNeedsReviewModalClaim();
  }

  const cls = (() => {
    switch (status) {
      case "uploaded":
        return "badge-uploaded";
      case "processing":
        return "badge-processing";
      case "processed":
        return "badge-processed";
      case "failed":
        return "badge-failed";
      case "needs_review":
        return "badge-needs-review";
      default:
        return "badge-uploaded";
    }
  })();

  const label = DocumentStatusLabels[status as DocumentStatus] ?? String(status);

  if (isNeedsReview && educationDismissed) {
    return (
      <InfoTooltip content={[...NEEDS_REVIEW_TOOLTIP.lines]}>
        <span className={cls}>
          {label} <span className="font-normal opacity-80">ⓘ</span>
        </span>
      </InfoTooltip>
    );
  }

  return (
    <>
      {showModal ? (
        <NeedsReviewEducationModal open={showModal} onDismiss={handleModalDismiss} />
      ) : null}
      <span className={cls}>{label}</span>
    </>
  );
}

export function DeductibleBadge({
  status,
}: {
  status: DeductibleStatus | string | null | undefined;
}) {
  if (!status) {
    return <span className="badge-deductible-unknown">—</span>;
  }
  const cls = (() => {
    switch (status) {
      case "yes":
        return "badge-deductible-yes";
      case "partial":
        return "badge-deductible-partial";
      case "no":
        return "badge-deductible-no";
      default:
        return "badge-deductible-unknown";
    }
  })();
  const label = DeductibleStatusLabels[status as DeductibleStatus] ?? String(status);
  return <span className={cls}>{label}</span>;
}
