// Read-only projection of the published synthetic study, not live/clinical metrics.
// Keep synchronized through project-integration regression tests; never invent scores.
export const researchSnapshot = {
  "synthetic": true,
  "source": "docs/rag-v2/results/SESSION_5_SYNTHETIC_SUMMARY.json",
  "sourceSha256": "fe31224cb2b016aab4c57575f28f4740abcd78019b85422fedf6526a0040e6c3",
  "implementationCommit": "566db2349a8f96879f2ec6ac4ba71af1edb2b131",
  "freezeCommit": "f02bda41d7e557267365bacff16a3f5f9639d297",
  "generatedAt": "2026-11-16T13:24:55.965Z",
  "dataset": {
    "version": "foundation-v2-fixtures/1.0.0",
    "scenarios": 16,
    "families": 4,
    "lockSha256": "dd25343c7961c26b9d76dc427c1b17d919d0593b84b398237c8bdb60681febb0"
  },
  "retrieval": {
    "LEXICAL_UNSCOPED": {
      "scenarios": 16,
      "answered": {
        "numerator": 16,
        "denominator": 16,
        "value": 1
      },
      "requestedReferenceRecallAt4": {
        "numerator": 16,
        "denominator": 30,
        "value": 0.5333333333333333
      },
      "wrongEntityOrSourceAnswers": {
        "numerator": 9,
        "denominator": 16,
        "value": 0.5625
      },
      "localDurationMs": 10.823789999999804
    },
    "ITEM_SCOPED_NO_FRESHNESS": {
      "scenarios": 16,
      "answered": {
        "numerator": 16,
        "denominator": 16,
        "value": 1
      },
      "requestedReferenceRecallAt4": {
        "numerator": 16,
        "denominator": 30,
        "value": 0.5333333333333333
      },
      "wrongEntityOrSourceAnswers": {
        "numerator": 0,
        "denominator": 16,
        "value": 0
      },
      "localDurationMs": 22.65295800000007
    },
    "ITEM_SCOPED_DEPENDENCY_FRESHNESS": {
      "scenarios": 16,
      "answered": {
        "numerator": 16,
        "denominator": 16,
        "value": 1
      },
      "requestedReferenceRecallAt4": {
        "numerator": 16,
        "denominator": 30,
        "value": 0.5333333333333333
      },
      "wrongEntityOrSourceAnswers": {
        "numerator": 0,
        "denominator": 16,
        "value": 0
      },
      "localDurationMs": 22.65295800000007
    }
  },
  "temporal": {
    "NO_INVALIDATION": {
      "sameAnswerCohort": 16,
      "exactStaleDetection": {
        "numerator": 0,
        "denominator": 16,
        "value": 0
      },
      "falseFreshAfterDependentEdit": {
        "numerator": 16,
        "denominator": 16,
        "value": 1
      },
      "falseStaleAfterUnrelatedEdit": {
        "numerator": 0,
        "denominator": 16,
        "value": 0
      },
      "lostFreshnessAfterUnrelatedEdit": {
        "numerator": 0,
        "denominator": 16,
        "value": 0
      }
    },
    "WHOLE_CASE_REVISION": {
      "sameAnswerCohort": 16,
      "exactStaleDetection": {
        "numerator": 16,
        "denominator": 16,
        "value": 1
      },
      "falseFreshAfterDependentEdit": {
        "numerator": 0,
        "denominator": 16,
        "value": 0
      },
      "falseStaleAfterUnrelatedEdit": {
        "numerator": 16,
        "denominator": 16,
        "value": 1
      },
      "lostFreshnessAfterUnrelatedEdit": {
        "numerator": 16,
        "denominator": 16,
        "value": 1
      }
    },
    "SIGNED_DEPENDENCIES": {
      "sameAnswerCohort": 16,
      "exactStaleDetection": {
        "numerator": 16,
        "denominator": 16,
        "value": 1
      },
      "falseFreshAfterDependentEdit": {
        "numerator": 0,
        "denominator": 16,
        "value": 0
      },
      "falseStaleAfterUnrelatedEdit": {
        "numerator": 0,
        "denominator": 16,
        "value": 0
      },
      "lostFreshnessAfterUnrelatedEdit": {
        "numerator": 0,
        "denominator": 16,
        "value": 0
      }
    }
  },
  "observedNetworkAttempts": 0
} as const;
