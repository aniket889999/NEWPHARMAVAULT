'use strict';
const { answerCase } = require('./caseAssistantService');
const { prioritizeCaseAnswerSources } = require('./citationPriorityPolicy');

async function answerCaseWithPriority(args) {
  // Authorization, snapshot locking, input validation and signing remain in the
  // reviewed service. No caller-provided answer/evidence enters the policy.
  const answer = await answerCase(args);
  return prioritizeCaseAnswerSources({ answer, message: args.message });
}

module.exports = { answerCaseWithPriority };
